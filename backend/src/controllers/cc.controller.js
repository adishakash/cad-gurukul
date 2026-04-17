'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const { createOrder: createRazorpayOrder } = require('../services/payment/razorpayService');
const { createCcSaleAndCommission } = require('../services/cc/ccPaymentService');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');

const COMMISSION_RATE = 0.70; // 70% on net sale amount

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextThursday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 4 = Thu … 6 = Sat
  const daysUntilThursday = day === 4 ? 7 : (4 - day + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilThursday);
  next.setHours(0, 0, 0, 0);
  return next;
}

async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existing = await prisma.ccTestLink.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate a unique test link code after 10 attempts.');
}

async function auditLog(userId, action, entityType, entityId, metadata = {}) {
  try {
    await prisma.activityLog.create({ data: { userId, action, entityType, entityId, metadata } });
  } catch (e) {
    logger.warn('[CC] Audit log write failed', { action, error: e.message });
  }
}

// ─── Account ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/counsellor/account
 *
 * Returns an income summary for the logged-in CC.
 */
const getAccountSummary = async (req, res) => {
  try {
    const ccUserId = req.user.id;

    const [salesAgg, commissions, discount] = await Promise.all([
      prisma.ccAttributedSale.aggregate({
        where: { ccUserId, status: 'confirmed' },
        _sum: { grossAmountPaise: true },
        _count: true,
      }),
      prisma.ccCommission.findMany({
        where: { ccUserId },
        select: { amountPaise: true, status: true },
      }),
      prisma.ccDiscount.findUnique({ where: { ccUserId } }),
    ]);

    const totalSalesPaise = salesAgg._sum.grossAmountPaise || 0;
    const totalSalesCount = salesAgg._count || 0;

    const totalCommissionPaise = commissions
      .filter((c) => c.status !== 'cancelled')
      .reduce((sum, c) => sum + c.amountPaise, 0);

    const pendingPayoutPaise = commissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amountPaise, 0);

    const paidAmountPaise = commissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.amountPaise, 0);

    return successResponse(res, {
      totalSalesPaise,
      totalSalesCount,
      totalCommissionPaise,
      pendingPayoutPaise,
      paidAmountPaise,
      nextPayoutDate: getNextThursday().toISOString().slice(0, 10),
      discount: discount
        ? { discountPct: discount.discountPct, planType: discount.planType, isActive: discount.isActive }
        : { discountPct: 0, planType: 'standard', isActive: false },
    });
  } catch (err) {
    logger.error('[CC] getAccountSummary error', { error: err.message });
    return errorResponse(res, 'Failed to load account summary', 500);
  }
};

/**
 * GET /api/v1/counsellor/account/transactions
 *
 * Returns paginated attributed sales for the logged-in CC.
 */
const listTransactions = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      prisma.ccAttributedSale.findMany({
        where: { ccUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          commission: { select: { amountPaise: true, status: true, payoutId: true } },
          testLink: { select: { code: true, candidateName: true, candidateEmail: true } },
        },
      }),
      prisma.ccAttributedSale.count({ where: { ccUserId } }),
    ]);

    return successResponse(res, {
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[CC] listTransactions error', { error: err.message });
    return errorResponse(res, 'Failed to load transactions', 500);
  }
};

// ─── Public: Test Link Resolution ────────────────────────────────────────────

/**
 * GET /api/v1/testlink/:code  (public — no auth)
 *
 * Resolves a test link code and returns display information for the
 * candidate-facing payment page. Computes effective fee after discount.
 */
const resolveTestLink = async (req, res) => {
  try {
    const { code } = req.params;

    const link = await prisma.ccTestLink.findUnique({
      where: { code },
      include: { ccUser: { select: { name: true } } },
    });

    if (!link) return errorResponse(res, 'Test link not found', 404, 'LINK_NOT_FOUND');

    const isExpired = link.expiresAt ? new Date() > new Date(link.expiresAt) : false;

    const discount = await prisma.ccDiscount.findUnique({ where: { ccUserId: link.ccUserId } });
    const MAX_DISCOUNT = link.planType === '499plan' ? 100 : 20;
    const effectiveDiscountPct =
      !link.isUsed && !isExpired && discount && discount.isActive
        ? Math.min(discount.discountPct, MAX_DISCOUNT)
        : 0;

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const netAmountPaise = link.feeAmountPaise - discountAmountPaise;

    return successResponse(res, {
      code: link.code,
      ccName: link.ccUser.name,
      planType: link.planType,
      candidateName:  link.candidateName,
      candidateEmail: link.candidateEmail,
      feeAmountPaise: link.feeAmountPaise,
      discountPct: effectiveDiscountPct,
      discountAmountPaise,
      netAmountPaise,
      isUsed: link.isUsed,
      isExpired,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    logger.error('[CC] resolveTestLink error', { error: err.message });
    return errorResponse(res, 'Failed to resolve test link', 500);
  }
};

/**
 * POST /api/v1/testlink/:code/order  (public — no auth)
 *
 * Validates the test link, applies the CC's active discount (plan-aware cap),
 * creates a Razorpay order for the net amount, and stores the orderId on
 * the link.
 *
 * Body: { candidateName?, candidateEmail?, candidatePhone? }
 */
const createTestOrder = async (req, res) => {
  try {
    const { code } = req.params;
    const { candidateName, candidateEmail, candidatePhone } = req.body;

    const link = await prisma.ccTestLink.findUnique({
      where: { code },
      include: { ccUser: { select: { name: true } } },
    });

    if (!link) return errorResponse(res, 'Test link not found', 404, 'LINK_NOT_FOUND');
    if (link.isUsed) return errorResponse(res, 'This test link has already been used', 409, 'LINK_ALREADY_USED');
    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return errorResponse(res, 'This test link has expired', 410, 'LINK_EXPIRED');
    }

    const discount = await prisma.ccDiscount.findUnique({ where: { ccUserId: link.ccUserId } });
    const MAX_DISCOUNT = link.planType === '499plan' ? 100 : 20;
    const effectiveDiscountPct = (discount && discount.isActive)
      ? Math.min(discount.discountPct, MAX_DISCOUNT)
      : 0;

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const netAmountPaise = link.feeAmountPaise - discountAmountPaise;

    // ── Free-access fast path (100% discount → net = 0) ──────────────────────
    // Razorpay does not accept ₹0 orders. Skip payment gateway entirely.
    if (netAmountPaise === 0) {
      const freePaymentId = `free_${link.code}_${Date.now()}`;

      await prisma.ccTestLink.update({
        where: { id: link.id },
        data: {
          testOrderId:        freePaymentId,
          testPaymentStatus:  'initiated',
          testNetAmountPaise: 0,
          ...(candidateName  && !link.candidateName  ? { candidateName }  : {}),
          ...(candidateEmail && !link.candidateEmail ? { candidateEmail } : {}),
          ...(candidatePhone && !link.candidatePhone ? { candidatePhone } : {}),
        },
      });

      await createCcSaleAndCommission({
        ccUserId:            link.ccUserId,
        testLinkId:          link.id,
        paymentId:           freePaymentId,
        razorpayPaymentId:   freePaymentId, // synthetic — no real gateway payment
        grossAmountPaise:    link.feeAmountPaise,
        discountAmountPaise: link.feeAmountPaise,
        netAmountPaise:      0,
      });

      logger.info('[CC] Free test link processed (100% discount)', { code, ccUserId: link.ccUserId });

      return successResponse(res, {
        free:                true,
        ccName:              link.ccUser.name,
        grossAmountPaise:    link.feeAmountPaise,
        discountAmountPaise: link.feeAmountPaise,
        netAmountPaise:      0,
      }, 'Free access granted', 201);
    }

    const order = await createRazorpayOrder({
      amount: netAmountPaise,
      currency: 'INR',
      receipt: `tl_${link.code}_${Date.now()}`,
      notes: {
        planType: link.planType,
        testLinkCode: code,
        ccUserId: link.ccUserId,
        candidateName:  candidateName  || link.candidateName  || '',
        candidateEmail: candidateEmail || link.candidateEmail || '',
      },
    });

    // Store orderId and net amount on the link
    await prisma.ccTestLink.update({
      where: { id: link.id },
      data: {
        testOrderId:          order.id,
        testPaymentStatus:    'initiated',
        testNetAmountPaise:   netAmountPaise,
        ...(candidateName  && !link.candidateName  ? { candidateName }  : {}),
        ...(candidateEmail && !link.candidateEmail ? { candidateEmail } : {}),
        ...(candidatePhone && !link.candidatePhone ? { candidatePhone } : {}),
      },
    });

    logger.info('[CC] Test order created', { code, orderId: order.id, netAmountPaise });

    return successResponse(res, {
      orderId:             order.id,
      amountPaise:         netAmountPaise,
      grossAmountPaise:    link.feeAmountPaise,
      discountAmountPaise,
      discountPct:         effectiveDiscountPct,
      currency:            'INR',
      keyId:               config.razorpay.keyId,
      ccName:              link.ccUser.name,
    }, 'Order created', 201);
  } catch (err) {
    logger.error('[CC] createTestOrder error', { error: err.message });
    return errorResponse(res, err.message || 'Failed to create payment order', 500);
  }
};

/**
 * POST /api/v1/testlink/:code/verify  (public — no auth)
 *
 * Verifies the Razorpay HMAC signature, then calls createCcSaleAndCommission
 * to atomically create the attributed sale and commission record.
 * Idempotent: safe to call multiple times for the same payment.
 *
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 */
const verifyTestPayment = async (req, res) => {
  try {
    const { code } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'razorpayOrderId, razorpayPaymentId and razorpaySignature are required', 400, 'MISSING_FIELDS');
    }

    if (!config.razorpay.keySecret) {
      logger.error('[CC] Razorpay keySecret not configured');
      return errorResponse(res, 'Payment verification unavailable', 503, 'CONFIG_ERROR');
    }

    // Verify HMAC: Razorpay signs `${orderId}|${paymentId}` with key_secret
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      logger.warn('[CC] Test payment signature mismatch', { code, razorpayOrderId });
      return errorResponse(res, 'Invalid payment signature', 400, 'INVALID_SIGNATURE');
    }

    const link = await prisma.ccTestLink.findUnique({ where: { code } });
    if (!link) return errorResponse(res, 'Test link not found', 404, 'LINK_NOT_FOUND');

    // Ensure this payment belongs to this link's order
    if (link.testOrderId !== razorpayOrderId) {
      return errorResponse(res, 'Payment order does not match this test link', 400, 'ORDER_MISMATCH');
    }

    const grossAmountPaise = link.feeAmountPaise;
    const netAmountPaise   = link.testNetAmountPaise ?? link.feeAmountPaise;
    const discountAmountPaise = grossAmountPaise - netAmountPaise;

    const { sale, isNew } = await createCcSaleAndCommission({
      ccUserId:          link.ccUserId,
      testLinkId:        link.id,
      paymentId:         razorpayPaymentId, // idempotency key
      razorpayPaymentId,
      grossAmountPaise,
      discountAmountPaise,
      netAmountPaise,
    });

    return successResponse(
      res,
      { saleId: sale.id, isNew },
      isNew ? 'Payment verified successfully' : 'Already processed',
    );
  } catch (err) {
    logger.error('[CC] verifyTestPayment error', { error: err.message });
    return errorResponse(res, 'Payment verification failed', 500);
  }
};

// ─── CC: Test Links ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/counsellor/test-links
 *
 * Lists paginated test links created by the logged-in CC.
 */
const listTestLinks = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const [links, total] = await Promise.all([
      prisma.ccTestLink.findMany({
        where: { ccUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ccTestLink.count({ where: { ccUserId } }),
    ]);

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    const enriched = links.map((l) => ({
      ...l,
      isExpired: l.expiresAt ? new Date() > new Date(l.expiresAt) : false,
      testUrl: `${frontendUrl}/testlink?ref=${l.code}`,
    }));

    return successResponse(res, {
      links: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[CC] listTestLinks error', { error: err.message });
    return errorResponse(res, 'Failed to load test links', 500);
  }
};

/**
 * POST /api/v1/counsellor/test-links
 *
 * Creates a new test link for a candidate.
 */
const createTestLink = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { planType = 'standard', candidateName, candidateEmail, candidatePhone, expiryDays, feeAmountPaise } = req.body;

    const code = await generateUniqueCode();
    const expiresAt = expiryDays
      ? new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000)
      : null;

    // Default fee by plan type if not explicitly provided
    const defaultFee = planType === '499plan' ? 49900 : 1200000;
    const resolvedFee = feeAmountPaise ? Number(feeAmountPaise) : defaultFee;

    const link = await prisma.ccTestLink.create({
      data: {
        ccUserId,
        code,
        planType,
        candidateName:  candidateName  || null,
        candidateEmail: candidateEmail || null,
        candidatePhone: candidatePhone || null,
        feeAmountPaise: resolvedFee,
        expiresAt,
      },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');

    await auditLog(ccUserId, 'cc.test_link.created', 'CcTestLink', link.id, {
      code: link.code,
      planType: link.planType,
      candidateEmail: link.candidateEmail,
      expiresAt: link.expiresAt,
    });

    return res.status(201).json({
      success: true,
      data: { ...link, testUrl: `${frontendUrl}/testlink?ref=${link.code}` },
    });
  } catch (err) {
    logger.error('[CC] createTestLink error', { error: err.message });
    return errorResponse(res, 'Failed to create test link', 500);
  }
};

// ─── CC: Payouts ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/counsellor/payouts
 *
 * Lists all payout batches for the logged-in CC.
 */
const listPayouts = async (req, res) => {
  try {
    const ccUserId = req.user.id;

    const payouts = await prisma.ccPayout.findMany({
      where: { ccUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { commissions: true } },
      },
    });

    return successResponse(res, payouts);
  } catch (err) {
    logger.error('[CC] listPayouts error', { error: err.message });
    return errorResponse(res, 'Failed to load payouts', 500);
  }
};

/**
 * GET /api/v1/counsellor/payouts/:id
 *
 * Returns a specific payout with its linked commission records.
 * Scoped to the logged-in CC — cannot read another CC's payouts.
 */
const getPayoutDetail = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { id } = req.params;

    const payout = await prisma.ccPayout.findFirst({
      where: { id, ccUserId },
      include: {
        commissions: {
          include: {
            attributedSale: {
              include: {
                testLink: { select: { code: true, candidateName: true, candidateEmail: true } },
              },
            },
          },
        },
      },
    });

    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');
    return successResponse(res, payout);
  } catch (err) {
    logger.error('[CC] getPayoutDetail error', { error: err.message });
    return errorResponse(res, 'Failed to load payout detail', 500);
  }
};

// ─── Discount Config ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/counsellor/discount
 */
const getDiscount = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const discount = await prisma.ccDiscount.findUnique({ where: { ccUserId } });
    return successResponse(res, discount
      ? { discountPct: discount.discountPct, planType: discount.planType, isActive: discount.isActive }
      : { discountPct: 0, planType: 'standard', isActive: false },
    );
  } catch (err) {
    logger.error('[CC] getDiscount error', { error: err.message });
    return errorResponse(res, 'Failed to load discount', 500);
  }
};

/**
 * PUT /api/v1/counsellor/discount
 *
 * Creates or updates the CC's discount setting.
 * discountPct is capped server-side based on planType:
 *   - '499plan': max 100%
 *   - 'standard': max 20%
 */
const updateDiscount = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    let { discountPct, planType, isActive } = req.body;

    // Belt-and-suspenders cap on top of Joi validation — plan-aware
    const MAX_DISCOUNT = planType === '499plan' ? 100 : 20;
    discountPct = Math.min(Number(discountPct), MAX_DISCOUNT);

    const existing = await prisma.ccDiscount.findUnique({ where: { ccUserId } });

    const discount = await prisma.ccDiscount.upsert({
      where:  { ccUserId },
      update: { discountPct, planType, isActive },
      create: { ccUserId, discountPct, planType, isActive },
    });

    await auditLog(ccUserId, 'cc.discount.updated', 'CcDiscount', discount.id, {
      oldPct: existing?.discountPct,
      newPct: discountPct,
      planType,
      oldActive: existing?.isActive,
      newActive: isActive,
    });

    return successResponse(res, { discountPct: discount.discountPct, planType: discount.planType, isActive: discount.isActive });
  } catch (err) {
    logger.error('[CC] updateDiscount error', { error: err.message });
    return errorResponse(res, 'Failed to update discount', 500);
  }
};

// ─── Training ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/counsellor/training
 *
 * Returns active training content items targeted at CC or ALL roles.
 */
const listTraining = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      where:   { isActive: true, targetRole: { in: ['CC', 'ALL'] } },
      orderBy: { displayOrder: 'asc' },
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[CC] listTraining error', { error: err.message });
    return errorResponse(res, 'Failed to load training content', 500);
  }
};

module.exports = {
  // Account
  getAccountSummary,
  listTransactions,
  // Public test link payment flow
  resolveTestLink,
  createTestOrder,
  verifyTestPayment,
  // CC test link management
  listTestLinks,
  createTestLink,
  // CC payouts
  listPayouts,
  getPayoutDetail,
  // Discount
  getDiscount,
  updateDiscount,
  // Training
  listTraining,
};
