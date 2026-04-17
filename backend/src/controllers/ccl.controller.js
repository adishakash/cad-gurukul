'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const { createOrder: createRazorpayOrder } = require('../services/payment/razorpayService');
const { createCclSaleAndCommission } = require('../services/ccl/cclPaymentService');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');

const COMMISSION_RATE = 0.10; // 10% on net sale amount
const MAX_DISCOUNT_PCT = 20;  // hard cap — also validated in Joi schema
const JOINING_FEE_PAISE = 1200000; // ₹12,000

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the date of the next Thursday (or following Thursday if today is
 * Thursday — payouts are scheduled a full week ahead when run on-day).
 * Time is set to midnight UTC.
 */
function getNextThursday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun … 4 = Thu … 6 = Sat
  const daysUntilThursday = day === 4 ? 7 : (4 - day + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilThursday);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * Generate a unique 8-char alphanumeric joining link code.
 * Retries up to 10 times to handle (rare) collisions.
 */
async function generateUniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existing = await prisma.cclJoiningLink.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate a unique joining link code after 10 attempts.');
}

/**
 * Write a non-fatal audit log entry.
 */
async function auditLog(userId, action, entityType, entityId, metadata = {}) {
  try {
    await prisma.activityLog.create({ data: { userId, action, entityType, entityId, metadata } });
  } catch (e) {
    logger.warn('[CCL] Audit log write failed', { action, error: e.message });
  }
}

// ─── Account ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/account
 *
 * Returns an income summary for the logged-in CCL.
 * All totals are computed from database records using aggregate queries.
 */
const getAccountSummary = async (req, res) => {
  try {
    const cclUserId = req.user.id;

    const [salesAgg, commissions, discount] = await Promise.all([
      prisma.cclAttributedSale.aggregate({
        where: { cclUserId, status: 'confirmed' },
        _sum: { grossAmountPaise: true },
        _count: true,
      }),
      prisma.cclCommission.findMany({
        where: { cclUserId },
        select: { amountPaise: true, status: true },
      }),
      prisma.cclDiscount.findUnique({ where: { cclUserId } }),
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
        ? { discountPct: discount.discountPct, isActive: discount.isActive }
        : { discountPct: 0, isActive: false },
    });
  } catch (err) {
    logger.error('[CCL] getAccountSummary error', { error: err.message });
    return errorResponse(res, 'Failed to load account summary', 500);
  }
};

/**
 * GET /api/v1/staff/account/transactions
 *
 * Returns paginated attributed sales for the logged-in CCL.
 * Query params: page (default 1), limit (default 20, max 100)
 */
const listTransactions = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const [sales, total] = await Promise.all([
      prisma.cclAttributedSale.findMany({
        where: { cclUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          commission: { select: { amountPaise: true, status: true, payoutId: true } },
          joiningLink: { select: { code: true, candidateName: true, candidateEmail: true } },
        },
      }),
      prisma.cclAttributedSale.count({ where: { cclUserId } }),
    ]);

    return successResponse(res, {
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[CCL] listTransactions error', { error: err.message });
    return errorResponse(res, 'Failed to load transactions', 500);
  }
};

// ─── Public: Joining Link Resolution ─────────────────────────────────────────

/**
 * GET /api/v1/join/:code  (public — no auth)
 *
 * Resolves a joining link code and returns display information for the
 * candidate-facing payment page. Computes effective fee after discount.
 */
const resolveJoiningLink = async (req, res) => {
  try {
    const { code } = req.params;

    const link = await prisma.cclJoiningLink.findUnique({
      where: { code },
      include: { cclUser: { select: { name: true } } },
    });

    if (!link) return errorResponse(res, 'Joining link not found', 404, 'LINK_NOT_FOUND');

    const isExpired = link.expiresAt ? new Date() > new Date(link.expiresAt) : false;

    // Phase 6: prefer inline discountPctUsed stored on the link; fall back to CclDiscount
    let effectiveDiscountPct = 0;
    if (!link.isUsed && !isExpired) {
      if (link.discountPctUsed > 0) {
        effectiveDiscountPct = Math.min(link.discountPctUsed, MAX_DISCOUNT_PCT);
      } else {
        const discount = await prisma.cclDiscount.findUnique({ where: { cclUserId: link.cclUserId } });
        if (discount && discount.isActive) {
          effectiveDiscountPct = Math.min(discount.discountPct, MAX_DISCOUNT_PCT);
        }
      }
    }

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const netAmountPaise = link.feeAmountPaise - discountAmountPaise;

    return successResponse(res, {
      code: link.code,
      cclName: link.cclUser.name,
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
    logger.error('[CCL] resolveJoiningLink error', { error: err.message });
    return errorResponse(res, 'Failed to resolve joining link', 500);
  }
};

/**
 * POST /api/v1/join/:code/create-order  (public — no auth)
 *
 * Validates the joining link, applies the CCL's active discount (≤20%),
 * creates a Razorpay order for the net amount, and stores the orderId on
 * the link. The candidate then opens Razorpay with the returned details.
 *
 * Body: { candidateName?, candidateEmail?, candidatePhone? }
 */
const createJoiningOrder = async (req, res) => {
  try {
    const { code } = req.params;
    const { candidateName, candidateEmail, candidatePhone } = req.body;

    const link = await prisma.cclJoiningLink.findUnique({
      where: { code },
      include: { cclUser: { select: { name: true } } },
    });

    if (!link) return errorResponse(res, 'Joining link not found', 404, 'LINK_NOT_FOUND');
    if (link.isUsed) return errorResponse(res, 'This joining link has already been used', 409, 'LINK_ALREADY_USED');
    if (link.expiresAt && new Date() > new Date(link.expiresAt)) {
      return errorResponse(res, 'This joining link has expired', 410, 'LINK_EXPIRED');
    }

    // Phase 6: prefer inline discountPctUsed stored on the link; fall back to CclDiscount
    let effectiveDiscountPct = 0;
    if (link.discountPctUsed > 0) {
      effectiveDiscountPct = Math.min(link.discountPctUsed, MAX_DISCOUNT_PCT);
    } else {
      const discount = await prisma.cclDiscount.findUnique({ where: { cclUserId: link.cclUserId } });
      if (discount && discount.isActive) {
        effectiveDiscountPct = Math.min(discount.discountPct, MAX_DISCOUNT_PCT);
      }
    }

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const netAmountPaise = link.feeAmountPaise - discountAmountPaise;

    const order = await createRazorpayOrder({
      amount: netAmountPaise,
      currency: 'INR',
      receipt: `jl_${link.code}_${Date.now()}`,
      notes: {
        planType: 'joining',
        joiningLinkCode: code,
        cclUserId: link.cclUserId,
        candidateName:  candidateName  || link.candidateName  || '',
        candidateEmail: candidateEmail || link.candidateEmail || '',
      },
    });

    // Store orderId and net amount on the link (overwrites any previous failed attempt)
    await prisma.cclJoiningLink.update({
      where: { id: link.id },
      data: {
        joiningOrderId:        order.id,
        joiningPaymentStatus:  'initiated',
        joiningNetAmountPaise: netAmountPaise,
        // Pre-fill candidate info if not already set
        ...(candidateName  && !link.candidateName  ? { candidateName }  : {}),
        ...(candidateEmail && !link.candidateEmail ? { candidateEmail } : {}),
        ...(candidatePhone && !link.candidatePhone ? { candidatePhone } : {}),
      },
    });

    logger.info('[CCL] Joining order created', { code, orderId: order.id, netAmountPaise });

    return successResponse(res, {
      orderId:             order.id,
      amountPaise:         netAmountPaise,
      grossAmountPaise:    link.feeAmountPaise,
      discountAmountPaise,
      discountPct:         effectiveDiscountPct,
      currency:            'INR',
      keyId:               config.razorpay.keyId,
      cclName:             link.cclUser.name,
    }, 'Order created', 201);
  } catch (err) {
    logger.error('[CCL] createJoiningOrder error', { error: err.message });
    return errorResponse(res, err.message || 'Failed to create payment order', 500);
  }
};

/**
 * POST /api/v1/join/:code/verify  (public — no auth)
 *
 * Verifies the Razorpay HMAC signature, then calls createCclSaleAndCommission
 * to atomically create the attributed sale and commission record.
 * Idempotent: safe to call multiple times for the same payment.
 *
 * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 */
const verifyJoiningPayment = async (req, res) => {
  try {
    const { code } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, 'razorpayOrderId, razorpayPaymentId and razorpaySignature are required', 400, 'MISSING_FIELDS');
    }

    if (!config.razorpay.keySecret) {
      logger.error('[CCL] Razorpay keySecret not configured');
      return errorResponse(res, 'Payment verification unavailable', 503, 'CONFIG_ERROR');
    }

    // Verify HMAC: Razorpay signs `${orderId}|${paymentId}` with key_secret
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      logger.warn('[CCL] Joining payment signature mismatch', { code, razorpayOrderId });
      return errorResponse(res, 'Invalid payment signature', 400, 'INVALID_SIGNATURE');
    }

    const link = await prisma.cclJoiningLink.findUnique({ where: { code } });
    if (!link) return errorResponse(res, 'Joining link not found', 404, 'LINK_NOT_FOUND');

    // Ensure this payment belongs to this link's order
    if (link.joiningOrderId !== razorpayOrderId) {
      return errorResponse(res, 'Payment order does not match this joining link', 400, 'ORDER_MISMATCH');
    }

    const grossAmountPaise = link.feeAmountPaise;
    const netAmountPaise   = link.joiningNetAmountPaise ?? link.feeAmountPaise;
    const discountAmountPaise = grossAmountPaise - netAmountPaise;

    const { sale, isNew } = await createCclSaleAndCommission({
      cclUserId:            link.cclUserId,
      joiningLinkId:        link.id,
      paymentId:            razorpayPaymentId, // idempotency key
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
    logger.error('[CCL] verifyJoiningPayment error', { error: err.message });
    return errorResponse(res, 'Payment verification failed', 500);
  }
};

// ─── CCL: Joining Links ───────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/joining-links
 *
 * Lists paginated joining links created by the logged-in CCL.
 * Query params: page, limit
 */
const listJoiningLinks = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const [links, total] = await Promise.all([
      prisma.cclJoiningLink.findMany({
        where: { cclUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cclJoiningLink.count({ where: { cclUserId } }),
    ]);

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    const enriched = links.map((l) => ({
      ...l,
      isExpired: l.expiresAt ? new Date() > new Date(l.expiresAt) : false,
      joinUrl: `${frontendUrl}/join?ref=${l.code}`,
    }));

    return successResponse(res, {
      links: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[CCL] listJoiningLinks error', { error: err.message });
    return errorResponse(res, 'Failed to load joining links', 500);
  }
};

/**
 * POST /api/v1/staff/joining-links
 *
 * Creates a new joining link for a candidate.
 * Accepts optional discountPct (validated against DiscountPolicy).
 */
const createJoiningLink = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    const { candidateName, candidateEmail, candidatePhone, expiresInDays, discountPct: rawDiscount } = req.body;

    // Validate and cap discount against DiscountPolicy
    let discountPct = 0;
    if (rawDiscount !== undefined && Number(rawDiscount) > 0) {
      const policy = await prisma.discountPolicy.findUnique({
        where: { role_planType: { role: 'CAREER_COUNSELLOR_LEAD', planType: 'joining' } },
      });
      const cap = policy ? policy.maxPct : MAX_DISCOUNT_PCT;
      const min = policy ? policy.minPct : 0;
      // NOTE: No DiscountPolicy configured for CAREER_COUNSELLOR_LEAD/joining — using default cap.
      // Admin should configure a policy via the Discounts section to enforce custom limits.
      if (!policy) logger.warn('[CCL] No DiscountPolicy found for joining links — defaulting to MAX_DISCOUNT_PCT', { cap });
      discountPct = Math.min(Math.max(Number(rawDiscount), min), cap);
    }

    const code = await generateUniqueCode();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null;

    const link = await prisma.cclJoiningLink.create({
      data: {
        cclUserId,
        code,
        candidateName:  candidateName  || null,
        candidateEmail: candidateEmail || null,
        candidatePhone: candidatePhone || null,
        expiresAt,
        discountPctUsed: discountPct,
      },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');

    await auditLog(cclUserId, 'ccl.joining_link.created', 'CclJoiningLink', link.id, {
      code: link.code,
      candidateEmail: link.candidateEmail,
      expiresAt: link.expiresAt,
    });

    return res.status(201).json({
      success: true,
      data: { ...link, joinUrl: `${frontendUrl}/join?ref=${link.code}` },
    });
  } catch (err) {
    logger.error('[CCL] createJoiningLink error', { error: err.message });
    return errorResponse(res, 'Failed to create joining link', 500);
  }
};

// ─── CCL: Payouts ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/payouts
 *
 * Lists all payout batches for the logged-in CCL.
 */
const listPayouts = async (req, res) => {
  try {
    const cclUserId = req.user.id;

    const payouts = await prisma.cclPayout.findMany({
      where: { cclUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { commissions: true } },
      },
    });

    return successResponse(res, payouts);
  } catch (err) {
    logger.error('[CCL] listPayouts error', { error: err.message });
    return errorResponse(res, 'Failed to load payouts', 500);
  }
};

/**
 * GET /api/v1/staff/payouts/:id
 *
 * Returns a specific payout with its linked commission records.
 * Scoped to the logged-in CCL — cannot read another CCL's payouts.
 */
const getPayoutDetail = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    const { id } = req.params;

    const payout = await prisma.cclPayout.findFirst({
      where: { id, cclUserId },
      include: {
        commissions: {
          include: {
            attributedSale: {
              include: {
                joiningLink: { select: { code: true, candidateName: true, candidateEmail: true } },
              },
            },
          },
        },
      },
    });

    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');
    return successResponse(res, payout);
  } catch (err) {
    logger.error('[CCL] getPayoutDetail error', { error: err.message });
    return errorResponse(res, 'Failed to load payout detail', 500);
  }
};

/**
 * GET /api/v1/staff/discount-policy?planType=joining
 *
 * Returns the admin-configured allowed discount range for CCL's planType.
 * Falls back to defaults if no policy exists.
 */
const getDiscountPolicy = async (req, res) => {
  try {
    const planType = req.query.planType || 'joining';
    const policy = await prisma.discountPolicy.findUnique({
      where: { role_planType: { role: 'CAREER_COUNSELLOR_LEAD', planType } },
    });
    return successResponse(res, {
      planType,
      minPct:   policy ? policy.minPct   : 0,
      maxPct:   policy ? policy.maxPct   : MAX_DISCOUNT_PCT,
      isActive: policy ? policy.isActive : true,
    });
  } catch (err) {
    logger.error('[CCL] getDiscountPolicy error', { error: err.message });
    return errorResponse(res, 'Failed to load discount policy', 500);
  }
};

// ─── Discount Config ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/discount
 */
const getDiscount = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    const discount = await prisma.cclDiscount.findUnique({ where: { cclUserId } });
    return successResponse(res, discount
      ? { discountPct: discount.discountPct, isActive: discount.isActive }
      : { discountPct: 0, isActive: false },
    );
  } catch (err) {
    logger.error('[CCL] getDiscount error', { error: err.message });
    return errorResponse(res, 'Failed to load discount', 500);
  }
};

/**
 * PUT /api/v1/staff/discount
 *
 * Creates or updates the CCL's discount setting.
 * discountPct is capped at MAX_DISCOUNT_PCT (20) server-side.
 */
const updateDiscount = async (req, res) => {
  try {
    const cclUserId = req.user.id;
    let { discountPct, isActive } = req.body;

    // Belt-and-suspenders cap on top of Joi validation
    discountPct = Math.min(Number(discountPct), MAX_DISCOUNT_PCT);

    const existing = await prisma.cclDiscount.findUnique({ where: { cclUserId } });

    const discount = await prisma.cclDiscount.upsert({
      where:  { cclUserId },
      update: { discountPct, isActive },
      create: { cclUserId, discountPct, isActive },
    });

    await auditLog(cclUserId, 'ccl.discount.updated', 'CclDiscount', discount.id, {
      oldPct: existing?.discountPct,
      newPct: discountPct,
      oldActive: existing?.isActive,
      newActive: isActive,
    });

    return successResponse(res, { discountPct: discount.discountPct, isActive: discount.isActive });
  } catch (err) {
    logger.error('[CCL] updateDiscount error', { error: err.message });
    return errorResponse(res, 'Failed to update discount', 500);
  }
};

// ─── Training ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/staff/training
 *
 * Returns all active training content items ordered by displayOrder.
 * originalFilename is intentionally excluded — staff only see admin-given title.
 */
const listTraining = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      where:   { isActive: true, targetRole: { in: ['CCL', 'ALL'] } },
      orderBy: { displayOrder: 'asc' },
      select:  { id: true, title: true, type: true, description: true, isDownloadable: true, targetRole: true, displayOrder: true },
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[CCL] listTraining error', { error: err.message });
    return errorResponse(res, 'Failed to load training content', 500);
  }
};

/**
 * GET /api/v1/staff/training/:id/file[?download=true]
 *
 * Authenticated file serving — only CCL-visible content is accessible.
 * Streams the file inline for viewing; use ?download=true to get attachment.
 * Enforces isDownloadable flag when download is requested.
 */
const serveTrainingFile = async (req, res) => {
  try {
    const { id } = req.params;
    const isDownload = req.query.download === 'true';

    const item = await prisma.cclTrainingContent.findFirst({
      where: { id, isActive: true, targetRole: { in: ['CCL', 'ALL'] } },
    });

    if (!item)            return errorResponse(res, 'Resource not found', 404, 'NOT_FOUND');
    if (!item.storagePath) return errorResponse(res, 'File not available', 404, 'NOT_FOUND');

    if (isDownload && !item.isDownloadable) {
      return errorResponse(res, 'Download not permitted for this resource', 403, 'FORBIDDEN');
    }

    const path = require('path');
    const contentType = item.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (isDownload) {
      // Use admin title as the download filename (hides original file name)
      const ext = path.extname(item.storagePath);
      const safeTitle = item.title.replace(/[^a-zA-Z0-9\-_.]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}${ext}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    res.sendFile(item.storagePath, (err) => {
      if (err && !res.headersSent) {
        logger.error('[CCL] serveTrainingFile sendFile error', { error: err.message, id });
        errorResponse(res, 'File not accessible', 500);
      }
    });
  } catch (err) {
    logger.error('[CCL] serveTrainingFile error', { error: err.message });
    return errorResponse(res, 'Failed to serve file', 500);
  }
};

module.exports = {
  // Account
  getAccountSummary,
  listTransactions,
  // Public joining payment flow
  resolveJoiningLink,
  createJoiningOrder,
  verifyJoiningPayment,
  // CCL joining link management
  listJoiningLinks,
  createJoiningLink,
  // CCL payouts
  listPayouts,
  getPayoutDetail,
  // Discount policy (Phase 6)
  getDiscountPolicy,
  // Discount (legacy)
  getDiscount,
  updateDiscount,
  // Training
  listTraining,
  serveTrainingFile,
};

