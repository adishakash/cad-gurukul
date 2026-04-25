'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const { createOrder: createRazorpayOrder } = require('../services/payment/razorpayService');
const { createCcSaleAndCommission } = require('../services/cc/ccPaymentService');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');
const { splitGstFromInclusive, addGstToExclusive } = require('../utils/gst');
const { generateCcReferralCode } = require('../utils/referralCode');

const COMMISSION_RATE = 0.70; // 70% on net sale amount

const buildGstFromSubtotal = (subtotalPaise) => {
  const rate = config.gst?.rate || 0;

  if (config.gst?.included === false) {
    const { totalPaise, gstPaise } = addGstToExclusive(subtotalPaise, rate);
    return {
      gstRate: rate,
      gstIncluded: false,
      gstAmountPaise: gstPaise,
      taxableAmountPaise: subtotalPaise,
      totalAmountPaise: totalPaise,
    };
  }

  const { basePaise, gstPaise } = splitGstFromInclusive(subtotalPaise, rate);
  return {
    gstRate: rate,
    gstIncluded: true,
    gstAmountPaise: gstPaise,
    taxableAmountPaise: basePaise,
    totalAmountPaise: subtotalPaise,
  };
};

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

function getWeekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday start
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getMonthStart(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function generateUniqueCouponCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const existing = await prisma.ccCoupon.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate a unique coupon code after 10 attempts.');
}

async function resolveCouponPolicy(planType) {
  const policy = await prisma.discountPolicy.findUnique({
    where: { role_planType: { role: 'CAREER_COUNSELLOR', planType } },
  });
  const defaultMax = planType === 'standard' ? 100 : 20;
  return {
    minPct: policy ? policy.minPct : 0,
    maxPct: policy ? policy.maxPct : defaultMax,
    isActive: policy ? policy.isActive : true,
  };
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

    const weekStart = getWeekStart();
    const monthStart = getMonthStart();

    const [salesAgg, salesWeekAgg, salesMonthAgg, commissions, commissionWeekAgg, commissionMonthAgg, discount] = await Promise.all([
      prisma.ccAttributedSale.aggregate({
        where: { ccUserId, status: 'confirmed' },
        _sum: { grossAmountPaise: true },
        _count: true,
      }),
      prisma.ccAttributedSale.aggregate({
        where: { ccUserId, status: 'confirmed', createdAt: { gte: weekStart } },
        _sum: { grossAmountPaise: true },
      }),
      prisma.ccAttributedSale.aggregate({
        where: { ccUserId, status: 'confirmed', createdAt: { gte: monthStart } },
        _sum: { grossAmountPaise: true },
      }),
      prisma.ccCommission.findMany({
        where: { ccUserId },
        select: { amountPaise: true, status: true },
      }),
      prisma.ccCommission.aggregate({
        where: { ccUserId, status: { not: 'cancelled' }, createdAt: { gte: weekStart } },
        _sum: { amountPaise: true },
      }),
      prisma.ccCommission.aggregate({
        where: { ccUserId, status: { not: 'cancelled' }, createdAt: { gte: monthStart } },
        _sum: { amountPaise: true },
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

    const weekSalesPaise = salesWeekAgg._sum.grossAmountPaise || 0;
    const monthSalesPaise = salesMonthAgg._sum.grossAmountPaise || 0;
    const weekIncomePaise = commissionWeekAgg._sum.amountPaise || 0;
    const monthIncomePaise = commissionMonthAgg._sum.amountPaise || 0;

    return successResponse(res, {
      totalSalesPaise,
      totalBusinessPaise: totalSalesPaise,
      totalSalesCount,
      totalCommissionPaise,
      pendingPayoutPaise,
      paidAmountPaise,
      weekSalesPaise,
      monthSalesPaise,
      weekIncomePaise,
      monthIncomePaise,
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
          ccCoupon: { select: { code: true } },
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

/**
 * GET /api/v1/counsellor/referral-link
 * Returns or creates the single CC referral link.
 */
const getReferralLink = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { ccReferralCode: true },
    });

    let code = user?.ccReferralCode || null;
    if (!code) {
      code = await generateCcReferralCode();
      await prisma.user.update({
        where: { id: ccUserId },
        data: { ccReferralCode: code },
      });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    return successResponse(res, {
      code,
      url: `${frontendUrl}/?ref=${code}`,
    });
  } catch (err) {
    logger.error('[CC] getReferralLink error', { error: err.message });
    return errorResponse(res, 'Failed to load referral link', 500);
  }
};

/**
 * GET /api/v1/counsellor/referral-stats
 * Returns lead/assessment stats for the CC referral link.
 */
const getReferralStats = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { ccReferralCode: true },
    });

    let code = user?.ccReferralCode || null;
    if (!code) {
      code = await generateCcReferralCode();
      await prisma.user.update({
        where: { id: ccUserId },
        data: { ccReferralCode: code },
      });
    }

    const where = { referralCode: code };
    const [totalLeads, assessmentStarted, assessmentCompleted, paidLeads, consultationLeads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, assessmentId: { not: null } } }),
      prisma.lead.count({
        where: {
          ...where,
          status: {
            in: [
              'assessment_completed',
              'free_report_ready',
              'payment_pending',
              'paid',
              'premium_report_generating',
              'premium_report_ready',
              'counselling_interested',
              'closed',
            ],
          },
        },
      }),
      prisma.lead.count({
        where: {
          ...where,
          status: {
            in: ['paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed'],
          },
        },
      }),
      prisma.lead.count({ where: { ...where, planType: 'consultation' } }),
    ]);

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    return successResponse(res, {
      code,
      url: `${frontendUrl}/?ref=${code}`,
      totals: {
        leads: totalLeads,
        assessmentStarted,
        assessmentCompleted,
        paid: paidLeads,
        consultations: consultationLeads,
      },
    });
  } catch (err) {
    logger.error('[CC] getReferralStats error', { error: err.message });
    return errorResponse(res, 'Failed to load referral stats', 500);
  }
};

/**
 * GET /api/v1/counsellor/coupons
 */
const listCoupons = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const coupons = await prisma.ccCoupon.findMany({
      where: { ccUserId },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, coupons);
  } catch (err) {
    logger.error('[CC] listCoupons error', { error: err.message });
    return errorResponse(res, 'Failed to load coupons', 500);
  }
};

/**
 * POST /api/v1/counsellor/coupons
 */
const createCoupon = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { code, planType, discountPct: rawDiscountPct, isActive, maxRedemptions, expiresAt } = req.body;

    const policy = await resolveCouponPolicy(planType);
    const cappedDiscountPct = Math.min(Math.max(Number(rawDiscountPct) || 0, policy.minPct), policy.maxPct);

    const couponCode = (code || '').trim().toUpperCase() || await generateUniqueCouponCode();

    const coupon = await prisma.ccCoupon.create({
      data: {
        ccUserId,
        code: couponCode,
        planType,
        discountPct: cappedDiscountPct,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await auditLog(ccUserId, 'cc.coupon.created', 'CcCoupon', coupon.id, {
      code: coupon.code,
      planType: coupon.planType,
      discountPct: coupon.discountPct,
    });

    return successResponse(res, coupon, 'Coupon created', 201);
  } catch (err) {
    logger.error('[CC] createCoupon error', { error: err.message });
    return errorResponse(res, err.message || 'Failed to create coupon', 500);
  }
};

/**
 * PATCH /api/v1/counsellor/coupons/:id
 */
const updateCoupon = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { id } = req.params;
    const { discountPct: rawDiscountPct, isActive, maxRedemptions, expiresAt } = req.body;

    const existing = await prisma.ccCoupon.findFirst({ where: { id, ccUserId } });
    if (!existing) return errorResponse(res, 'Coupon not found', 404, 'NOT_FOUND');

    const updateData = {};
    if (rawDiscountPct !== undefined) {
      const policy = await resolveCouponPolicy(existing.planType);
      updateData.discountPct = Math.min(Math.max(Number(rawDiscountPct) || 0, policy.minPct), policy.maxPct);
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (maxRedemptions !== undefined) updateData.maxRedemptions = maxRedemptions ? Number(maxRedemptions) : null;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    if (Object.keys(updateData).length === 0) {
      return successResponse(res, existing, 'No changes applied');
    }

    const coupon = await prisma.ccCoupon.update({
      where: { id },
      data: updateData,
    });

    await auditLog(ccUserId, 'cc.coupon.updated', 'CcCoupon', coupon.id, updateData);

    return successResponse(res, coupon, 'Coupon updated');
  } catch (err) {
    logger.error('[CC] updateCoupon error', { error: err.message });
    return errorResponse(res, 'Failed to update coupon', 500);
  }
};

/**
 * DELETE /api/v1/counsellor/coupons/:id
 */
const deleteCoupon = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { id } = req.params;

    const existing = await prisma.ccCoupon.findFirst({ where: { id, ccUserId } });
    if (!existing) return errorResponse(res, 'Coupon not found', 404, 'NOT_FOUND');

    const coupon = await prisma.ccCoupon.update({
      where: { id },
      data: { isActive: false },
    });

    await auditLog(ccUserId, 'cc.coupon.deactivated', 'CcCoupon', coupon.id, { code: coupon.code });

    return successResponse(res, coupon, 'Coupon deactivated');
  } catch (err) {
    logger.error('[CC] deleteCoupon error', { error: err.message });
    return errorResponse(res, 'Failed to deactivate coupon', 500);
  }
};

/**
 * GET /api/v1/counsellor/consultations/upcoming
 */
const listUpcomingConsultations = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { isConsultationAuthorized: true },
    });

    if (!user?.isConsultationAuthorized) {
      return errorResponse(res, 'Consultation access not authorized', 403, 'FORBIDDEN');
    }

    const now = new Date();
    const bookings = await prisma.consultationBooking.findMany({
      where: {
        counsellorUserId: ccUserId,
        scheduledStartAt: { not: null, gte: now },
      },
      orderBy: { scheduledStartAt: 'asc' },
      include: {
        user: {
          select: {
            email: true,
            studentProfile: { select: { fullName: true, mobileNumber: true } },
          },
        },
      },
    });

    const enriched = bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      scheduledStartAt: booking.scheduledStartAt,
      scheduledEndAt: booking.scheduledEndAt,
      meetingLink: booking.meetingLink || booking.googleMeetLink || null,
      studentName: booking.user?.studentProfile?.fullName || booking.user?.email || 'Student',
      studentEmail: booking.user?.email || null,
      studentPhone: booking.user?.studentProfile?.mobileNumber || null,
    }));

    return successResponse(res, enriched);
  } catch (err) {
    logger.error('[CC] listUpcomingConsultations error', { error: err.message });
    return errorResponse(res, 'Failed to load consultations', 500);
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

    // Phase 6: prefer inline discountPctUsed stored on the link; fall back to CcDiscount
    const MAX_DISCOUNT = link.planType === '499plan' ? 100 : 20;
    let effectiveDiscountPct = 0;
    if (!link.isUsed && !isExpired) {
      if (link.discountPctUsed > 0) {
        effectiveDiscountPct = Math.min(link.discountPctUsed, MAX_DISCOUNT);
      } else {
        const discount = await prisma.ccDiscount.findUnique({ where: { ccUserId: link.ccUserId } });
        if (discount && discount.isActive) {
          effectiveDiscountPct = Math.min(discount.discountPct, MAX_DISCOUNT);
        }
      }
    }

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const subtotalPaise = link.feeAmountPaise - discountAmountPaise;
    const gstBreakdown = buildGstFromSubtotal(subtotalPaise);

    return successResponse(res, {
      code: link.code,
      ccName: link.ccUser.name,
      planType: link.planType,
      candidateName:  link.candidateName,
      candidateEmail: link.candidateEmail,
      feeAmountPaise: link.feeAmountPaise,
      discountPct: effectiveDiscountPct,
      discountAmountPaise,
      netAmountPaise: gstBreakdown.totalAmountPaise,
      gstRate: gstBreakdown.gstRate,
      gstIncluded: gstBreakdown.gstIncluded,
      gstAmountPaise: gstBreakdown.gstAmountPaise,
      taxableAmountPaise: gstBreakdown.taxableAmountPaise,
      totalAmountPaise: gstBreakdown.totalAmountPaise,
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

    // Phase 6: prefer inline discountPctUsed stored on the link; fall back to CcDiscount
    const MAX_DISCOUNT = link.planType === '499plan' ? 100 : 20;
    let effectiveDiscountPct = 0;
    if (link.discountPctUsed > 0) {
      effectiveDiscountPct = Math.min(link.discountPctUsed, MAX_DISCOUNT);
    } else {
      const discount = await prisma.ccDiscount.findUnique({ where: { ccUserId: link.ccUserId } });
      if (discount && discount.isActive) {
        effectiveDiscountPct = Math.min(discount.discountPct, MAX_DISCOUNT);
      }
    }

    const discountAmountPaise = Math.round(link.feeAmountPaise * effectiveDiscountPct / 100);
    const subtotalPaise = link.feeAmountPaise - discountAmountPaise;
    const gstBreakdown = buildGstFromSubtotal(subtotalPaise);
    const totalAmountPaise = gstBreakdown.totalAmountPaise;

    // ── Free-access fast path (100% discount → net = 0) ──────────────────────
    // Razorpay does not accept ₹0 orders. Skip payment gateway entirely.
    if (totalAmountPaise === 0) {
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
        planType:            link.planType,
        commissionRate:      COMMISSION_RATE,
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
      amount: totalAmountPaise,
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
        testNetAmountPaise:   totalAmountPaise,
        ...(candidateName  && !link.candidateName  ? { candidateName }  : {}),
        ...(candidateEmail && !link.candidateEmail ? { candidateEmail } : {}),
        ...(candidatePhone && !link.candidatePhone ? { candidatePhone } : {}),
      },
    });

    logger.info('[CC] Test order created', { code, orderId: order.id, netAmountPaise: totalAmountPaise });

    return successResponse(res, {
      orderId:             order.id,
      amountPaise:         totalAmountPaise,
      grossAmountPaise:    link.feeAmountPaise,
      discountAmountPaise,
      discountPct:         effectiveDiscountPct,
      gstRate:             gstBreakdown.gstRate,
      gstIncluded:         gstBreakdown.gstIncluded,
      gstAmountPaise:      gstBreakdown.gstAmountPaise,
      taxableAmountPaise:  gstBreakdown.taxableAmountPaise,
      totalAmountPaise:    gstBreakdown.totalAmountPaise,
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
    const totalAmountPaise = link.testNetAmountPaise ?? link.feeAmountPaise;
    const { basePaise: taxableAmountPaise } = splitGstFromInclusive(totalAmountPaise, config.gst?.rate);
    const discountAmountPaise = config.gst?.included === false
      ? grossAmountPaise - taxableAmountPaise
      : grossAmountPaise - totalAmountPaise;
    const netAmountPaise = taxableAmountPaise;

    const { sale, isNew } = await createCcSaleAndCommission({
      ccUserId:          link.ccUserId,
      testLinkId:        link.id,
      paymentId:         razorpayPaymentId, // idempotency key
      razorpayPaymentId,
      grossAmountPaise,
      discountAmountPaise,
      netAmountPaise,
      planType:          link.planType,
      commissionRate:    COMMISSION_RATE,
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
 * Accepts optional discountPct (validated against DiscountPolicy).
 */
const createTestLink = async (req, res) => {
  try {
    const ccUserId = req.user.id;
    const { planType = 'standard', candidateName, candidateEmail, candidatePhone, expiryDays, feeAmountPaise, discountPct: rawDiscount } = req.body;

    // Validate and cap discount against DiscountPolicy
    let discountPct = 0;
    if (rawDiscount !== undefined && Number(rawDiscount) > 0) {
      const policy = await prisma.discountPolicy.findUnique({
        where: { role_planType: { role: 'CAREER_COUNSELLOR', planType } },
      });
      const defaultMax = planType === '499plan' ? 100 : 20;
      const cap = policy ? policy.maxPct : defaultMax;
      const min = policy ? policy.minPct : 0;
      // NOTE: No DiscountPolicy configured for CAREER_COUNSELLOR/{planType} — using default cap.
      // Admin should configure a policy via the Discounts section to enforce custom limits.
      if (!policy) logger.warn('[CC] No DiscountPolicy found for planType — defaulting', { planType, cap });
      discountPct = Math.min(Math.max(Number(rawDiscount), min), cap);
    }

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
        discountPctUsed: discountPct,
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

/**
 * GET /api/v1/counsellor/discount-policy?planType=499plan
 *
 * Returns the admin-configured allowed discount range for CC's planType.
 * Falls back to defaults if no policy exists.
 */
const getDiscountPolicy = async (req, res) => {
  try {
    const planType = req.query.planType || 'standard';
    const policy = await prisma.discountPolicy.findUnique({
      where: { role_planType: { role: 'CAREER_COUNSELLOR', planType } },
    });
    // Default caps: 499plan = 100%, others = 20%
    const defaultMax = planType === '499plan' ? 100 : 20;
    return successResponse(res, {
      planType,
      minPct:   policy ? policy.minPct   : 0,
      maxPct:   policy ? policy.maxPct   : defaultMax,
      isActive: policy ? policy.isActive : true,
    });
  } catch (err) {
    logger.error('[CC] getDiscountPolicy error', { error: err.message });
    return errorResponse(res, 'Failed to load discount policy', 500);
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
 * originalFilename is intentionally excluded — staff only see admin-given title.
 */
const listTraining = async (req, res) => {
  try {
    const content = await prisma.cclTrainingContent.findMany({
      where:   { isActive: true, targetRole: { in: ['CC', 'ALL'] } },
      orderBy: { displayOrder: 'asc' },
      select:  { id: true, title: true, type: true, description: true, isDownloadable: true, targetRole: true, displayOrder: true, url: true },
    });
    return successResponse(res, content);
  } catch (err) {
    logger.error('[CC] listTraining error', { error: err.message });
    return errorResponse(res, 'Failed to load training content', 500);
  }
};

/**
 * GET /api/v1/counsellor/training/:id/file[?download=true]
 *
 * Authenticated file serving — only CC-visible content is accessible.
 * Streams the file inline for viewing; use ?download=true to get attachment.
 * Enforces isDownloadable flag when download is requested.
 */
const serveTrainingFile = async (req, res) => {
  try {
    const { id } = req.params;
    const isDownload = req.query.download === 'true';

    const item = await prisma.cclTrainingContent.findFirst({
      where: { id, isActive: true, targetRole: { in: ['CC', 'ALL'] } },
    });

    if (!item)             return errorResponse(res, 'Resource not found', 404, 'NOT_FOUND');
    if (!item.storagePath) return errorResponse(res, 'File not available', 404, 'NOT_FOUND');

    if (isDownload && !item.isDownloadable) {
      return errorResponse(res, 'Download not permitted for this resource', 403, 'FORBIDDEN');
    }

    const path = require('path');
    // Path traversal guard: ensure the resolved path stays within the uploads directory
    const UPLOADS_BASE = path.resolve(__dirname, '../../uploads/training');
    const resolvedPath = path.resolve(item.storagePath);
    if (!resolvedPath.startsWith(UPLOADS_BASE + path.sep) && !resolvedPath.startsWith(UPLOADS_BASE)) {
      logger.error('[CC] serveTrainingFile path traversal attempt blocked', { id, storagePath: item.storagePath });
      return errorResponse(res, 'File not accessible', 403, 'FORBIDDEN');
    }

    const contentType = item.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (isDownload) {
      const ext = path.extname(item.storagePath);
      const safeTitle = item.title.replace(/[^a-zA-Z0-9\-_.]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}${ext}"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    res.sendFile(resolvedPath, (err) => {
      if (err && !res.headersSent) {
        logger.error('[CC] serveTrainingFile sendFile error', { error: err.message, id });
        errorResponse(res, 'File not accessible', 500);
      }
    });
  } catch (err) {
    logger.error('[CC] serveTrainingFile error', { error: err.message });
    return errorResponse(res, 'Failed to serve file', 500);
  }
};

module.exports = {
  // Account
  getAccountSummary,
  listTransactions,
  getReferralLink,
  getReferralStats,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listUpcomingConsultations,
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
  // Discount policy (Phase 6)
  getDiscountPolicy,
  // Discount (legacy)
  getDiscount,
  updateDiscount,
  // Training
  listTraining,
  serveTrainingFile,
};
