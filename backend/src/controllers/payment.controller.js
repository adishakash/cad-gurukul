'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { createCcSaleAndCommission } = require('../services/cc/ccPaymentService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');
const { triggerAutomation } = require('../services/automation/automationService');
const analytics = require('../services/analytics/analyticsService');
const { sendConsultationSlotEmail } = require('../services/email/emailService');
const { getEffectiveChargeAmount } = require('../utils/testPricing');
const { safeLeadUpdate } = require('../utils/leadStatusHelper');
const { splitGstFromInclusive, addGstToExclusive } = require('../utils/gst');
const {
  PLAN_PRICES,
  normalizePlanType,
  isPlanIncluded,
  getUpgradePrice,
  formatRupees,
  PAID_STATUSES,
} = require('../utils/planPricing');

// Back-compat: keep the old constant so webhook path doesn't break
const PAID_REPORT_PRICE_RUPEES = PLAN_PRICES.standard;
const PAID_QUESTION_LIMIT = 30;

const getAmountRupeesForPlan = (planType = 'standard') => PLAN_PRICES[planType] || PAID_REPORT_PRICE_RUPEES;

const buildGstBreakdown = (subtotalPaise) => {
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

const normalizeCode = (value) => (value ? String(value).trim().toUpperCase() : '');

const buildAttributionError = (message, code) => {
  const err = new Error(message);
  err.statusCode = 400;
  err.errorCode = code || 'ATTRIBUTION_ERROR';
  return err;
};

const resolveCcAttribution = async ({ couponCode, referralCode, planType }) => {
  const normalizedCoupon = normalizeCode(couponCode);
  const normalizedReferral = normalizeCode(referralCode);

  let coupon = null;
  let ccUser = null;

  if (normalizedCoupon) {
    coupon = await prisma.ccCoupon.findUnique({ where: { code: normalizedCoupon } });
    if (!coupon || !coupon.isActive) {
      throw buildAttributionError('Coupon code is invalid or inactive.', 'INVALID_COUPON');
    }
    if (coupon.planType !== planType) {
      throw buildAttributionError('Coupon is not valid for this plan.', 'COUPON_PLAN_MISMATCH');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw buildAttributionError('Coupon has expired.', 'COUPON_EXPIRED');
    }
    if (coupon.maxRedemptions && coupon.usageCount >= coupon.maxRedemptions) {
      throw buildAttributionError('Coupon usage limit reached.', 'COUPON_LIMIT_REACHED');
    }

    ccUser = await prisma.user.findUnique({
      where: { id: coupon.ccUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true, suspendedAt: true },
    });

    if (!ccUser || ccUser.role !== 'CAREER_COUNSELLOR' || !ccUser.isActive || ccUser.deletedAt || ccUser.suspendedAt) {
      throw buildAttributionError('Coupon owner is not eligible for attribution.', 'COUPON_OWNER_INVALID');
    }
  }

  let referralUser = null;
  if (normalizedReferral) {
    referralUser = await prisma.user.findFirst({
      where: {
        ccReferralCode: normalizedReferral,
        role: 'CAREER_COUNSELLOR',
        isActive: true,
        deletedAt: null,
        suspendedAt: null,
      },
      select: { id: true },
    });
  }

  if (coupon && normalizedReferral && (!referralUser || referralUser.id !== coupon.ccUserId)) {
    throw buildAttributionError('Coupon does not match referral link.', 'COUPON_REFERRAL_MISMATCH');
  }

  const resolvedUserId = ccUser?.id || referralUser?.id || null;
  if (!resolvedUserId && !coupon) return null;

  const policy = await prisma.discountPolicy.findUnique({
    where: { role_planType: { role: 'CAREER_COUNSELLOR', planType } },
  });
  const absoluteMax = planType === 'standard' ? 100 : 20;
  const policyMax = policy ? policy.maxPct : absoluteMax;
  const cappedDiscountPct = coupon
    ? Math.min(coupon.discountPct, Math.min(policyMax, absoluteMax))
    : 0;

  return {
    ccUserId: resolvedUserId,
    ccCouponId: coupon?.id || null,
    couponCode: coupon?.code || null,
    referralCode: normalizedReferral || null,
    discountPct: cappedDiscountPct,
  };
};

const resolveCcUserByReferral = async (referralCode) => {
  const normalized = normalizeCode(referralCode);
  if (!normalized) return null;
  return prisma.user.findFirst({
    where: {
      ccReferralCode: normalized,
      role: 'CAREER_COUNSELLOR',
      isActive: true,
      deletedAt: null,
      suspendedAt: null,
    },
    select: { id: true, isConsultationAuthorized: true },
  });
};

const createCcSaleFromPayment = async ({ payment, planType, lead }) => {
  const metadata = payment.metadata || {};
  let ccUserId = metadata.ccUserId || null;
  const ccCouponId = metadata.ccCouponId || null;
  const couponCode = metadata.ccCouponCode || null;
  let referralCode = metadata.ccReferralCode || null;

  if (!ccUserId && !referralCode && lead?.referralCode) {
    referralCode = lead.referralCode;
  }

  let ccUser = null;
  if (!ccUserId && referralCode) {
    ccUser = await resolveCcUserByReferral(referralCode);
    ccUserId = ccUser?.id || null;
  } else if (ccUserId) {
    ccUser = await prisma.user.findUnique({
      where: { id: ccUserId },
      select: { id: true, isConsultationAuthorized: true, isActive: true, deletedAt: true, suspendedAt: true },
    });
    if (!ccUser || !ccUser.isActive || ccUser.deletedAt || ccUser.suspendedAt) {
      ccUserId = null;
    }
  }

  if (!ccUserId) return null;

  const commissionRate = planType === 'consultation'
    ? (ccUser?.isConsultationAuthorized ? 0.5 : 0.1)
    : 0.7;

  const grossAmountPaise = metadata.catalogAmountPaise || payment.amountPaise;
  const discountAmountPaise = metadata.discountAmountPaise || 0;
  const netAmountPaise = metadata.taxableAmountPaise ?? Math.max(0, grossAmountPaise - discountAmountPaise);

  const paymentId = payment.razorpayPaymentId || payment.id;

  return createCcSaleAndCommission({
    ccUserId,
    testLinkId: null,
    paymentId,
    razorpayPaymentId: paymentId,
    grossAmountPaise,
    discountAmountPaise,
    netAmountPaise,
    saleType: 'referral',
    planType,
    commissionRate,
    ccCouponId,
    couponCode,
  });
};

const finalizeCapturedPayment = async ({ payment, planType, assessmentId, userId, req, source }) => {
  const amountRupees = getAmountRupeesForPlan(planType);

  let reportIdForGeneration = null;
  let assessmentForGeneration = null;
  let profileForGeneration = null;
  let assessmentSnapshot = null;
  let hasRemainingQuestions = false;

  if (planType !== 'consultation' && assessmentId) {
    assessmentSnapshot = await prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
      include: { answers: true },
    });

    if (assessmentSnapshot) {
      const answeredCount = assessmentSnapshot.answers.length;
      hasRemainingQuestions = answeredCount < PAID_QUESTION_LIMIT;
      const shouldResume = assessmentSnapshot.status === 'COMPLETED' && hasRemainingQuestions;

      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          accessLevel: 'PAID',
          totalQuestions: PAID_QUESTION_LIMIT,
          ...(shouldResume ? { status: 'IN_PROGRESS', completedAt: null, currentStep: answeredCount } : {}),
        },
      });
    }

    const existingReport = await prisma.careerReport.findFirst({ where: { assessmentId } });
    if (existingReport) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { reportId: existingReport.id },
      });

      const canGenerate = Boolean(assessmentSnapshot)
        && !hasRemainingQuestions
        && assessmentSnapshot.status === 'COMPLETED';

      if (canGenerate) {
        await prisma.careerReport.update({
          where: { id: existingReport.id },
          data: { accessLevel: 'PAID', status: 'GENERATING', reportType: planType },
        });

        reportIdForGeneration = existingReport.id;

        [assessmentForGeneration, profileForGeneration] = await Promise.all([
          prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: { questions: true, answers: true },
          }),
          prisma.studentProfile.findUnique({
            where: { userId },
            include: { parentDetail: true },
          }),
        ]);
      }
    }
  }

  const lead = await prisma.lead.findFirst({ where: { userId } });
  if (lead) {
    const nextStatus = getLeadStatusAfterPayment(planType, Boolean(reportIdForGeneration));

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        paymentId: payment.id,
        planType,
        status: nextStatus,
        ...(planType === 'consultation' ? { counsellingInterested: true } : {}),
      },
    });

    await triggerAutomation(getAutomationEventForPlan(planType), {
      leadId:   lead.id,
      userId,
      planType,
      amountRupees,
      paymentId: payment.id,
    });
  }

  analytics.track('payment_success', req || null, {
    userId,
    planType,
    amountRupees,
    ...(source ? { source } : {}),
  });

  if (assessmentForGeneration && profileForGeneration && reportIdForGeneration) {
    const { generateReportAsync } = require('./assessment.controller');
    generateReportAsync(assessmentForGeneration, profileForGeneration, reportIdForGeneration, planType);
  }

  if (planType === 'consultation') {
    _createConsultationBookingAndSendEmail({
      userId,
      paymentId: payment.id,
      leadId: lead?.id || null,
    }).catch((err) =>
      logger.error('[Payment] Consultation booking creation failed', { error: err.message }),
    );
  }

  await createCcSaleFromPayment({ payment, planType, lead });

  return { resumeAssessment: planType !== 'consultation' && hasRemainingQuestions };
};

const getLeadStatusAfterPayment = (planType, hasQueuedReport) => {
  if (planType === 'consultation') return 'counselling_interested';
  return hasQueuedReport ? 'premium_report_generating' : 'paid';
};

const getAutomationEventForPlan = (planType) => {
  if (planType === 'consultation') return 'consultation_booked';
  if (planType === 'premium') return 'premium_ai_purchased';
  return 'payment_success';
};

const getHighestCapturedPlan = (payments = []) => {
  return payments.reduce((highestPlan, payment) => {
    const planType = normalizePlanType(payment?.metadata?.planType || 'free');
    return isPlanIncluded(planType, highestPlan) ? planType : highestPlan;
  }, 'free');
};

const resolveCurrentPlanForUser = async (userId) => {
  const [lead, consultationBooking, capturedPayments] = await Promise.all([
    prisma.lead.findFirst({
      where: { userId },
      select: { planType: true, status: true },
    }),
    prisma.consultationBooking.findFirst({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { userId, status: 'CAPTURED' },
      select: { metadata: true },
    }),
  ]);

  if (consultationBooking) return 'consultation';

  const highestCapturedPlan = getHighestCapturedPlan(capturedPayments);
  if (highestCapturedPlan !== 'free') return highestCapturedPlan;

  const leadPlanType = normalizePlanType(lead?.planType || 'free');
  if (lead && PAID_STATUSES.includes(lead.status) && leadPlanType !== 'free') {
    return leadPlanType;
  }

  return 'free';
};

const buildQuote = ({ currentPlan, requestedPlan, discountPct = 0 }) => {
  const targetPlan = normalizePlanType(requestedPlan);
  const sourcePlan = normalizePlanType(currentPlan);
  const basePrice = PLAN_PRICES[targetPlan];
  const effectivePrice = getUpgradePrice(sourcePlan, targetPlan);
  const alreadyIncluded = isPlanIncluded(sourcePlan, targetPlan);
  const alreadyOwned = sourcePlan === targetPlan && sourcePlan !== 'free';
  const effectivePricePaise = rupeesToPaise(effectivePrice);
  const discountAmountPaise = Math.round(effectivePricePaise * (Number(discountPct) || 0) / 100);
  const discountedSubtotalPaise = Math.max(0, effectivePricePaise - discountAmountPaise);
  const gstBreakdown = buildGstBreakdown(discountedSubtotalPaise);
  const discountedTotalRupees = gstBreakdown.totalAmountPaise / 100;

  return {
    currentPlan: sourcePlan,
    requestedPlan: targetPlan,
    basePrice,
    effectivePrice,
    basePriceLabel: formatRupees(basePrice),
    effectivePriceLabel: formatRupees(effectivePrice),
    isUpgrade: sourcePlan !== 'free' && !alreadyIncluded,
    upgradeFrom: sourcePlan !== 'free' && !alreadyIncluded ? sourcePlan : null,
    alreadyIncluded,
    alreadyOwned,
    canPurchase: !alreadyIncluded && !alreadyOwned,
    discountPct: Number(discountPct) || 0,
    discountAmountPaise,
    discountedTotalRupees,
    discountedTotalLabel: formatRupees(discountedTotalRupees),
    gstRate: gstBreakdown.gstRate,
    gstIncluded: gstBreakdown.gstIncluded,
    gstAmountPaise: gstBreakdown.gstAmountPaise,
    taxableAmountPaise: gstBreakdown.taxableAmountPaise,
    totalAmountPaise: gstBreakdown.totalAmountPaise,
    gstAmountLabel: formatRupees(gstBreakdown.gstAmountPaise / 100),
    taxableAmountLabel: formatRupees(gstBreakdown.taxableAmountPaise / 100),
  };
};

const getQuote = async (req, res) => {
  try {
    const requestedPlan = normalizePlanType(req.query.planType || 'standard');
    if (!PLAN_PRICES[requestedPlan] || requestedPlan === 'free') {
      return errorResponse(res, 'Invalid plan type', 400, 'INVALID_PLAN');
    }

    let discountPct = 0;
    try {
      const attribution = await resolveCcAttribution({
        couponCode: req.query.couponCode,
        referralCode: req.query.referralCode,
        planType: requestedPlan,
      });
      discountPct = attribution?.discountPct || 0;
    } catch (err) {
      return errorResponse(res, err.message || 'Invalid coupon', err.statusCode || 400, err.errorCode || 'INVALID_COUPON');
    }

    const currentPlan = await resolveCurrentPlanForUser(req.user.id);
    return successResponse(res, buildQuote({ currentPlan, requestedPlan, discountPct }));
  } catch (err) {
    logger.error('[Payment] getQuote error', { error: err.message });
    throw err;
  }
};

/**
 * POST /payments/create-order
 * Creates a Razorpay order and a pending payment record.
 * Body: { assessmentId, planType? }  — planType: "standard" | "premium" | "consultation"
 */
const createOrder = async (req, res) => {
  try {
    const { assessmentId, planType = 'standard', couponCode, referralCode } = req.body;

    // Validate planType
    if (!PLAN_PRICES[planType]) {
      return errorResponse(res, 'Invalid plan type', 400, 'INVALID_PLAN');
    }

    let attribution = null;
    try {
      attribution = await resolveCcAttribution({ couponCode, referralCode, planType });
    } catch (err) {
      return errorResponse(res, err.message || 'Invalid coupon', err.statusCode || 400, err.errorCode || 'INVALID_COUPON');
    }

    const currentPlan = await resolveCurrentPlanForUser(req.user.id);
    const quote = buildQuote({ currentPlan, requestedPlan: planType, discountPct: attribution?.discountPct || 0 });
    if (quote.alreadyOwned) {
      return errorResponse(res, `You already have the ${planType} plan on your account.`, 409, 'ALREADY_OWNED');
    }
    if (quote.alreadyIncluded) {
      return errorResponse(res, `${planType} is already included in your ${currentPlan} plan.`, 409, 'PLAN_INCLUDED');
    }

    // CONSULTATION orders don't require an assessment
    if (planType !== 'consultation') {
      const assessment = await prisma.assessment.findFirst({
        where: { id: assessmentId, userId: req.user.id },
      });
      if (!assessment) {
        return errorResponse(res, 'Assessment not found', 404, 'NOT_FOUND');
      }
    }

    // Prevent duplicate captured payment for the same assessment + planType
    if (assessmentId) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          userId: req.user.id,
          status: 'CAPTURED',
          AND: [
            { metadata: { path: ['assessmentId'], equals: assessmentId } },
            ...(planType !== 'standard'
              ? [{ metadata: { path: ['planType'], equals: planType } }]
              : []),
          ],
        },
      });
      if (existingPayment) {
        return errorResponse(res, 'Payment already completed for this plan', 409, 'CONFLICT');
      }
    }

    const amountRupees = quote.effectivePrice;
    const amountPaise  = rupeesToPaise(amountRupees);
    const discountPct = attribution?.discountPct || 0;
    const discountAmountPaise = Math.round(amountPaise * discountPct / 100);
    const discountedSubtotalPaise = Math.max(0, amountPaise - discountAmountPaise);
    const gstBreakdown = buildGstBreakdown(discountedSubtotalPaise);
    const orderAmountPaise = gstBreakdown.totalAmountPaise;

    const ccMetadata = attribution
      ? {
          ccUserId: attribution.ccUserId,
          ccCouponId: attribution.ccCouponId,
          ccCouponCode: attribution.couponCode,
          ccReferralCode: attribution.referralCode,
        }
      : {};

    const baseMetadata = {
      assessmentId: assessmentId || null,
      planType,
      currentPlan,
      effectiveAmountRupees: amountRupees,
      catalogAmountPaise: amountPaise,
      discountPct,
      discountAmountPaise,
      gstRate: gstBreakdown.gstRate,
      gstIncluded: gstBreakdown.gstIncluded,
      gstAmountPaise: gstBreakdown.gstAmountPaise,
      taxableAmountPaise: gstBreakdown.taxableAmountPaise,
      totalAmountPaise: gstBreakdown.totalAmountPaise,
      ...ccMetadata,
    };

    if (orderAmountPaise === 0) {
      const freeOrderId = `free_${crypto.randomUUID()}`;
      const payment = await prisma.payment.create({
        data: {
          userId: req.user.id,
          amountPaise,
          currency: 'INR',
          status: 'CAPTURED',
          razorpayOrderId: freeOrderId,
          razorpayPaymentId: freeOrderId,
          paidAt: new Date(),
          metadata: baseMetadata,
        },
      });

      const { resumeAssessment } = await finalizeCapturedPayment({
        payment,
        planType,
        assessmentId,
        userId: req.user.id,
        req,
        source: 'free',
      });

      return successResponse(res, {
        free: true,
        paymentId: payment.id,
        planType,
        resumeAssessment,
        quote,
      }, 'Free purchase recorded', 201);
    }

    // ── Test pricing override ─────────────────────────────────────────────────
    // In PAYMENT_TEST_MODE the charge sent to Razorpay is reduced (₹1/₹2/₹3).
    // The DB record always stores the real catalog price (amountPaise).
    const { chargeAmountPaise, isTestMode } = getEffectiveChargeAmount(orderAmountPaise);
    if (isTestMode) {
      logger.warn('[Payment] TEST MODE — charging reduced amount', {
        planType, originalPaise: amountPaise, chargePaise: chargeAmountPaise,
      });
    }

    // Create Razorpay order
    const receiptBase = assessmentId ? assessmentId.slice(0, 12) : req.user.id.slice(0, 12);
    const order = await razorpayService.createOrder({
      amount: chargeAmountPaise,   // ← test amount in test mode, full amount in prod
      currency: 'INR',
      receipt: `cg_${planType[0]}_${receiptBase}`,
      notes: { userId: req.user.id, assessmentId: assessmentId || null, planType },
    });

    // Save payment record — always stores CATALOG price so reports/admin are correct
    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        amountPaise,             // catalog price — real plan price
        currency: 'INR',
        status: 'CREATED',
        razorpayOrderId: order.id,
        metadata: {
          ...baseMetadata,
          ...(isTestMode ? { testMode: true, chargeAmountPaise } : {}),
        },
      },
    });

    // Track analytics
    analytics.track('payment_initiated', req, { userId: req.user.id, planType, amountRupees });
    analytics.track('plan_selected', req, { userId: req.user.id, planType, amountRupees });

    // Link lead to payment_pending
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead) {
      await safeLeadUpdate(lead.id, { status: 'payment_pending', planType });
      await triggerAutomation('payment_initiated', { leadId: lead.id, userId: req.user.id, planType });
    }

    logger.info('[Payment] Order created', { paymentId: payment.id, orderId: order.id, planType });

    return successResponse(res, {
      orderId:  order.id,
      amount:   chargeAmountPaise,   // actual Razorpay charge (test or catalog)
      currency: 'INR',
      keyId:    config.razorpay.keyId,
      paymentId: payment.id,
      planType,
      quote,
    }, 'Order created', 201);
  } catch (err) {
    logger.error('[Payment] createOrder error', { error: err.message });
    throw err;
  }
};

/**
 * POST /payments/verify
 * Verify Razorpay payment signature and unlock paid report.
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Fetch payment record
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment || payment.userId !== req.user.id) {
      return errorResponse(res, 'Payment record not found', 404, 'NOT_FOUND');
    }

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      logger.warn('[Payment] Signature mismatch', { paymentId: payment.id });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      return errorResponse(res, 'Payment verification failed', 400, 'PAYMENT_VERIFICATION_FAILED');
    }

    // Update payment as captured
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date(),
      },
    });

    // ─── Determine plan type from metadata ────────────────────────────────────
    const planType = payment.metadata?.planType || 'standard';
    const assessmentId = payment.metadata?.assessmentId;

    logger.info('[Payment] Payment verified', { paymentId: payment.id, razorpayPaymentId, planType });

    const { resumeAssessment } = await finalizeCapturedPayment({
      payment: updatedPayment,
      planType,
      assessmentId,
      userId: req.user.id,
      req,
      source: 'verify',
    });

    const successMsg = planType === 'consultation'
      ? 'Booking confirmed! Your scheduling email is being prepared now.'
      : 'Payment successful! Your report is being generated.';

    return successResponse(
      res,
      {
        paymentId: payment.id,
        status: 'CAPTURED',
        planType,
        assessmentId: assessmentId || null,
        resumeAssessment,
      },
      successMsg
    );
  } catch (err) {
    logger.error('[Payment] verifyPayment error', { error: err.message });
    throw err;
  }
};

/**
 * POST /payments/webhook
 * Razorpay server webhook (idempotent backup capture flow).
 */
const handleWebhook = async (req, res) => {
  try {
    if (!config.razorpay.webhookSecret) {
      logger.warn('[Payment] webhookSecret missing, webhook ignored');
      return successResponse(res, { received: true, ignored: true }, 'Webhook ignored');
    }

    const signature = req.headers['x-razorpay-signature'];
    const bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    const expected = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    if (!signature || signature !== expected) {
      logger.warn('[Payment] Webhook signature mismatch');
      return errorResponse(res, 'Invalid webhook signature', 400, 'INVALID_SIGNATURE');
    }

    const payload = JSON.parse(bodyBuffer.toString('utf8'));

    // ── Refund event: create CommissionAdjustment to reverse commission ────────
    if (payload.event === 'payment.refunded' || payload.event === 'refund.created') {
      try {
        const refundEntity  = payload.payload?.refund?.entity || payload.payload?.payment?.entity;
        const rzpPaymentId  = refundEntity?.payment_id || refundEntity?.id;
        const refundAmount  = Math.round((refundEntity?.amount || 0) / 100); // paise → rupees

        if (rzpPaymentId && refundAmount > 0) {
          const payment = await prisma.payment.findFirst({
            where: { razorpayPaymentId: rzpPaymentId },
            select: { id: true, ccCommissionId: true, cclCommissionId: true, userId: true },
          });

          if (payment) {
            // Create reversal adjustments for any linked commissions
            if (payment.ccCommissionId) {
              await prisma.commissionAdjustment.create({
                data: {
                  targetId:   payment.ccCommissionId,
                  targetType: 'CC',
                  type:       'REFUND_REVERSAL',
                  amountDelta: -refundAmount,
                  reason:      `Razorpay refund for payment ${rzpPaymentId}`,
                  createdBy:   'SYSTEM',
                },
              }).catch(() => {});
            }
            if (payment.cclCommissionId) {
              await prisma.commissionAdjustment.create({
                data: {
                  targetId:   payment.cclCommissionId,
                  targetType: 'CCL',
                  type:       'REFUND_REVERSAL',
                  amountDelta: -refundAmount,
                  reason:      `Razorpay refund for payment ${rzpPaymentId}`,
                  createdBy:   'SYSTEM',
                },
              }).catch(() => {});
            }
            logger.info('[Payment] Refund adjustments created', { rzpPaymentId, refundAmount });
          }
        }
      } catch (refundErr) {
        logger.error('[Payment] Refund commission adjustment error', { error: refundErr.message });
      }
      return successResponse(res, { received: true }, 'Refund processed');
    }

    if (payload.event !== 'payment.captured') {
      return successResponse(res, { received: true, ignored: true }, 'Webhook ignored');
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;

    if (!razorpayOrderId) {
      return errorResponse(res, 'Missing order reference', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment) {
      // Check if this is a joining link payment (stored on CclJoiningLink, not Payment table)
      const joiningLink = await prisma.cclJoiningLink.findFirst({
        where: { joiningOrderId: razorpayOrderId },
      });

      if (!joiningLink) {
        // Check if this is a CC test link payment
        const testLink = await prisma.ccTestLink.findFirst({
          where: { testOrderId: razorpayOrderId },
        });

        if (!testLink) {
          logger.warn('[Payment] Webhook for unknown order', { razorpayOrderId });
          return successResponse(res, { received: true, ignored: true }, 'Unknown order');
        }

        if (testLink.testPaymentStatus === 'captured') {
          return successResponse(res, { received: true, ignored: true }, 'CC test payment already processed');
        }

        try {
          const { createCcSaleAndCommission } = require('../services/cc/ccPaymentService');
          const grossAmountPaise = testLink.feeAmountPaise;
          const totalAmountPaise = testLink.testNetAmountPaise ?? testLink.feeAmountPaise;
          const { basePaise: taxableAmountPaise } = splitGstFromInclusive(totalAmountPaise, config.gst?.rate);
          const discountAmountPaise = config.gst?.included === false
            ? grossAmountPaise - taxableAmountPaise
            : grossAmountPaise - totalAmountPaise;
          const netAmountPaise = taxableAmountPaise;

          await createCcSaleAndCommission({
            ccUserId:          testLink.ccUserId,
            testLinkId:        testLink.id,
            paymentId:         razorpayPaymentId,
            razorpayPaymentId,
            grossAmountPaise,
            discountAmountPaise,
            netAmountPaise,
            planType:          testLink.planType,
            commissionRate:    0.70,
          });

          logger.info('[Payment] CC test link payment processed via webhook', {
            code: testLink.code,
            paymentId: razorpayPaymentId,
          });
        } catch (err) {
          logger.error('[Payment] Webhook CC test payment error', { error: err.message, razorpayOrderId });
        }

        return successResponse(res, { received: true }, 'CC test payment processed');
      }

      // Idempotency: if already captured, return success
      if (joiningLink.joiningPaymentStatus === 'captured') {
        return successResponse(res, { received: true, ignored: true }, 'Joining payment already processed');
      }

      // Delegate to the shared CCL payment service
      try {
        const { createCclSaleAndCommission } = require('../services/ccl/cclPaymentService');
        const grossAmountPaise = joiningLink.feeAmountPaise;
        const totalAmountPaise = joiningLink.joiningNetAmountPaise ?? joiningLink.feeAmountPaise;
        const { basePaise: taxableAmountPaise } = splitGstFromInclusive(totalAmountPaise, config.gst?.rate);
        const discountAmountPaise = config.gst?.included === false
          ? grossAmountPaise - taxableAmountPaise
          : grossAmountPaise - totalAmountPaise;
        const netAmountPaise = taxableAmountPaise;

        await createCclSaleAndCommission({
          cclUserId:         joiningLink.cclUserId,
          joiningLinkId:     joiningLink.id,
          paymentId:         razorpayPaymentId,
          razorpayPaymentId,
          grossAmountPaise,
          discountAmountPaise,
          netAmountPaise,
        });

        logger.info('[Payment] Joining link payment processed via webhook', {
          code: joiningLink.code,
          paymentId: razorpayPaymentId,
        });
      } catch (err) {
        logger.error('[Payment] Webhook joining payment error', { error: err.message, razorpayOrderId });
      }

      return successResponse(res, { received: true }, 'Joining payment processed');
    }

    if (payment.status !== 'CAPTURED') {
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          razorpayPaymentId: razorpayPaymentId || payment.razorpayPaymentId,
          paidAt: payment.paidAt || new Date(),
        },
      });

      const assessmentId = payment.metadata?.assessmentId;
      const planType = payment.metadata?.planType || 'standard';

      await finalizeCapturedPayment({
        payment: updatedPayment,
        planType,
        assessmentId,
        userId: payment.userId,
        req: null,
        source: 'webhook',
      });
    }

    return successResponse(res, { received: true }, 'Webhook processed');
  } catch (err) {
    logger.error('[Payment] handleWebhook error', { error: err.message });
    return errorResponse(res, 'Webhook processing failed', 500, 'WEBHOOK_ERROR');
  }
};

/**
 * GET /payments/history
 */
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amountPaise: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        paidAt: true,
        createdAt: true,
        metadata: true,
      },
    });

    const sanitizedPayments = payments.map((payment) => ({
      id: payment.id,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      planType: payment.metadata?.planType || 'standard',
    }));

    return successResponse(res, sanitizedPayments);
  } catch (err) {
    logger.error('[Payment] getPaymentHistory error', { error: err.message });
    throw err;
  }
};

/**
 * GET /payments/status/:orderId
 * Lightweight status check — used by Payment.jsx after redirect to confirm capture.
 */
const getPaymentStatus = async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: req.params.orderId, userId: req.user.id },
      select: { id: true, status: true, amountPaise: true, paidAt: true, metadata: true },
    });

    if (!payment) return errorResponse(res, 'Payment not found', 404, 'NOT_FOUND');

    return successResponse(res, payment);
  } catch (err) {
    logger.error('[Payment] getPaymentStatus error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION BOOKING HELPER (private, fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a ConsultationBooking record and sends the scheduling email to the
 * registered student email. Called immediately after a ₹9,999
 * consultation payment is captured in verifyPayment / handleWebhook.
 *
 * Idempotent — if a booking already exists for this paymentId it returns early.
 */
async function _createConsultationBookingAndSendEmail({ userId, paymentId, leadId }) {
  // Idempotency guard
  const existing = await prisma.consultationBooking.findUnique({ where: { paymentId } });
  if (existing) {
    logger.info('[Payment] ConsultationBooking already exists, skipping', { paymentId });
    return existing;
  }

  // Secure, unguessable 64-char hex token for email links
  const slotToken = crypto.randomBytes(32).toString('hex');

  const booking = await prisma.consultationBooking.create({
    data: {
      id:        crypto.randomUUID(),
      userId,
      leadId:    leadId || null,
      paymentId,
      slotToken,
      status:    'booking_confirmed',
    },
  });

  // Append timeline event
  if (leadId) {
    await prisma.leadEvent.create({
      data: {
        id:       crypto.randomUUID(),
        leadId,
        event:    'consultation_booking_confirmed',
        metadata: { bookingId: booking.id },
      },
    }).catch((err) =>
      logger.warn('[Payment] ConsultationBooking LeadEvent failed', { error: err.message }),
    );
  }

  // Fetch the registered user email for scheduling
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      studentProfile: {
        select: { fullName: true },
      },
    },
  });

  const studentName = user?.studentProfile?.fullName
    || user?.email?.split('@')[0]
    || 'Student';

  const emailArgs = {
    slotToken,
    counsellorName:      booking.counsellorName,
    counsellorExpertise: booking.counsellorExpertise,
    counsellorContact:   booking.counsellorContact,
  };

  // Send only to the registered student email
  if (user?.email) {
    try {
      await sendConsultationSlotEmail({
        to:   user.email,
        name: studentName,
        ...emailArgs,
      });

      await prisma.consultationBooking.update({
        where: { id: booking.id },
        data: {
          status: 'slot_mail_sent',
          schedulingEmailSentAt: new Date(),
          schedulingEmailError: null,
          lastResendAt: new Date(),
        },
      });

      if (leadId) {
        await prisma.leadEvent.create({
          data: {
            id: crypto.randomUUID(),
            leadId,
            event: 'consultation_slot_mail_sent',
            metadata: { bookingId: booking.id },
          },
        }).catch(() => {});
      }
    } catch (err) {
      await prisma.consultationBooking.update({
        where: { id: booking.id },
        data: {
          status: 'booking_confirmed',
          schedulingEmailSentAt: null,
          schedulingEmailError: err.message,
        },
      }).catch(() => {});

      logger.warn('[Payment] Slot-selection email to student failed', { error: err.message });

      if (leadId) {
        await prisma.leadEvent.create({
          data: {
            id: crypto.randomUUID(),
            leadId,
            event: 'consultation_slot_mail_failed',
            metadata: { bookingId: booking.id, error: err.message },
          },
        }).catch(() => {});
      }
    }
  } else {
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        status: 'booking_confirmed',
        schedulingEmailSentAt: null,
        schedulingEmailError: 'Student email unavailable',
      },
    }).catch(() => {});

    if (leadId) {
      await prisma.leadEvent.create({
        data: {
          id: crypto.randomUUID(),
          leadId,
          event: 'consultation_slot_mail_failed',
          metadata: { bookingId: booking.id, error: 'Student email unavailable' },
        },
      }).catch(() => {});
    }
  }

  logger.info('[Payment] ConsultationBooking created', {
    bookingId: booking.id,
    userId,
    studentEmail: user?.email,
  });

  return booking;
}

module.exports = { createOrder, getQuote, verifyPayment, handleWebhook, getPaymentHistory, getPaymentStatus };
