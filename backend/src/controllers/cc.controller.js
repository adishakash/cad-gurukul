'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { generateCcReferralCode } = require('../utils/referralCode');
const {
  isSpacesEnabled,
  isSpacesStoragePath,
  stripSpacesStoragePath,
  getTrainingObjectStream,
  getSignedTrainingUrl,
  shouldRedirectSpacesDownloads,
  getSafeDownloadName,
} = require('../utils/spaces');


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
  // Business rules (hard limits — non-negotiable regardless of DB policy):
  //   standard (₹499)      → up to 100% off
  //   premium (₹1,999)     → up to 20% off
  //   consultation (₹9,999)→ up to 20% off
  const absoluteMax = planType === 'standard' ? 100 : 20;
  // For the standard plan, always use absoluteMax (100) — the DB policy must
  // never reduce what a counsellor is allowed to give on the ₹499 plan.
  // For other plans, admin-configurable policy can restrict within [0, absoluteMax].
  const policyMax = policy ? policy.maxPct : absoluteMax;
  const maxPct = planType === 'standard' ? absoluteMax : Math.min(policyMax, absoluteMax);
  const minPct = policy ? Math.min(policy.minPct, maxPct) : 0;
  return {
    minPct,
    maxPct,
    isActive: policy ? policy.isActive : true,
  };
}

/**
 * Write a non-fatal audit log entry.
 */
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
      select: { ccReferralCode: true, name: true },
    });

    let code = user?.ccReferralCode || null;
    if (!code) {
      code = await generateCcReferralCode(user?.name);
      await prisma.user.update({
        where: { id: ccUserId },
        data: { ccReferralCode: code },
      });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'https://cadgurukul.com').replace(/\/$/, '');
    return successResponse(res, {
      code,
      url: `${frontendUrl}/${encodeURIComponent(code.toLowerCase())}`,
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
      select: { ccReferralCode: true, name: true },
    });

    let code = user?.ccReferralCode || null;
    if (!code) {
      code = await generateCcReferralCode(user?.name);
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
      url: `${frontendUrl}/${encodeURIComponent(code.toLowerCase())}`,
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
            attributedSale: true,
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

    if (isSpacesStoragePath(item.storagePath)) {
      if (!isSpacesEnabled()) {
        return errorResponse(res, 'File storage is not available', 503, 'STORAGE_UNAVAILABLE');
      }

      const key = stripSpacesStoragePath(item.storagePath);
      const contentType = item.mimeType || 'application/octet-stream';
      const downloadName = getSafeDownloadName(item.title, key, item.originalFilename);

      try {
        if (shouldRedirectSpacesDownloads()) {
          const contentDisposition = isDownload
            ? `attachment; filename="${downloadName}"`
            : 'inline';
          const signedUrl = await getSignedTrainingUrl({
            key,
            contentType,
            contentDisposition,
          });
          return res.redirect(signedUrl);
        }

        const { stream, contentLength, contentType: objectType } = await getTrainingObjectStream(key);
        res.setHeader('Content-Type', contentType || objectType || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', isDownload ? `attachment; filename="${downloadName}"` : 'inline');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        stream.on('error', (err) => {
          logger.error('[CC] serveTrainingFile stream error', { error: err.message, id });
        });

        return stream.pipe(res);
      } catch (err) {
        const statusCode = err?.$metadata?.httpStatusCode;
        if (err?.name === 'NoSuchKey' || statusCode === 404) {
          return errorResponse(res, 'File not available', 404, 'NOT_FOUND');
        }
        logger.error('[CC] serveTrainingFile spaces error', { error: err.message, id });
        return errorResponse(res, 'File not accessible', 500);
      }
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
  // CC payouts
  listPayouts,
  getPayoutDetail,
  // Training
  listTraining,
  serveTrainingFile,
};
