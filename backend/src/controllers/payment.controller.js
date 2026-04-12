'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');
const { triggerAutomation } = require('../services/automation/automationService');
const analytics = require('../services/analytics/analyticsService');

// ── Value Ladder pricing ─────────────────────────────────────────────────────
const PLAN_PRICES = {
  standard:     499,    // Full report — stream + career suggestions
  premium:      1999,   // Deep AI analysis — personalised roadmap + subject strategy
  consultation: 9999,   // 1:1 Career Blueprint Session with Adish Gupta
};

// Back-compat: keep the old constant so webhook path doesn't break
const PAID_REPORT_PRICE_RUPEES = PLAN_PRICES.standard;

/**
 * POST /payments/create-order
 * Creates a Razorpay order and a pending payment record.
 * Body: { assessmentId, planType? }  — planType: "standard" | "premium" | "consultation"
 */
const createOrder = async (req, res) => {
  try {
    const { assessmentId, planType = 'standard' } = req.body;

    // Validate planType
    if (!PLAN_PRICES[planType]) {
      return errorResponse(res, 'Invalid plan type', 400, 'INVALID_PLAN');
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

    const amountRupees = PLAN_PRICES[planType];
    const amountPaise = rupeesToPaise(amountRupees);

    // Create Razorpay order
    const receiptBase = assessmentId ? assessmentId.slice(0, 12) : req.user.id.slice(0, 12);
    const order = await razorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: `cg_${planType[0]}_${receiptBase}`,
      notes: { userId: req.user.id, assessmentId: assessmentId || null, planType },
    });

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        amountPaise,
        currency: 'INR',
        status: 'CREATED',
        razorpayOrderId: order.id,
        metadata: { assessmentId: assessmentId || null, planType },
      },
    });

    // Track analytics
    analytics.track('payment_initiated', req, { userId: req.user.id, planType, amountRupees });
    analytics.track('plan_selected', req, { userId: req.user.id, planType, amountRupees });

    // Link lead to payment_pending
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'payment_pending', planType },
      });
      await triggerAutomation('payment_initiated', { leadId: lead.id, userId: req.user.id, planType });
    }

    logger.info('[Payment] Order created', { paymentId: payment.id, orderId: order.id, planType });

    return successResponse(res, {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      paymentId: payment.id,
      planType,
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
    const planType    = payment.metadata?.planType || 'standard';
    const assessmentId = payment.metadata?.assessmentId;
    const amountRupees = PLAN_PRICES[planType] || PAID_REPORT_PRICE_RUPEES;

    let reportIdForGeneration = null;
    let assessmentForGeneration = null;
    let profileForGeneration = null;

    // CONSULTATION: no report generation — just flag the lead
    if (planType !== 'consultation' && assessmentId) {
      await prisma.assessment.updateMany({
        where: { id: assessmentId, userId: req.user.id },
        data: { accessLevel: 'PAID', totalQuestions: 30 },
      });

      // Upgrade existing report record to PAID and queue regeneration
      const existingReport = await prisma.careerReport.findFirst({
        where: { assessmentId },
      });

      if (existingReport) {
        await prisma.careerReport.update({
          where: { id: existingReport.id },
          data: {
            accessLevel: 'PAID',
            status: 'GENERATING',
            reportType: planType, // "standard" | "premium"
          },
        });

        await prisma.payment.update({
          where: { id: updatedPayment.id },
          data: { reportId: existingReport.id },
        });

        reportIdForGeneration = existingReport.id;

        [assessmentForGeneration, profileForGeneration] = await Promise.all([
          prisma.assessment.findUnique({
            where: { id: assessmentId },
            include: { questions: true, answers: true },
          }),
          prisma.studentProfile.findUnique({
            where: { userId: req.user.id },
            include: { parentDetail: true },
          }),
        ]);
      }
    }

    logger.info('[Payment] Payment verified', { paymentId: payment.id, razorpayPaymentId, planType });

    // ─── Automation hooks post-payment ────────────────────────────────────────
    analytics.track('payment_success', req, { userId: req.user.id, planType, amountRupees });

    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead) {
      const nextStatus = planType === 'consultation'
        ? 'counselling_interested'
        : reportIdForGeneration
          ? 'premium_report_generating'
          : 'paid';

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          paymentId: updatedPayment.id,
          planType,
          status: nextStatus,
          ...(planType === 'consultation' ? { counsellingInterested: true } : {}),
        },
      });

      // Per-tier automation event
      const automationEvent = planType === 'consultation'
        ? 'consultation_booked'
        : planType === 'premium'
          ? 'premium_ai_purchased'
          : 'payment_success';

      await triggerAutomation(automationEvent, {
        leadId:      lead.id,
        userId:      req.user.id,
        planType,
        amountRupees,
        paymentId:   updatedPayment.id,
      });
    }

    // Fire-and-forget report generation
    if (assessmentForGeneration && profileForGeneration && reportIdForGeneration) {
      const { generateReportAsync } = require('./assessment.controller');
      generateReportAsync(assessmentForGeneration, profileForGeneration, reportIdForGeneration, planType);
    }

    const successMsg = planType === 'consultation'
      ? 'Booking confirmed! Our team will call you within 24 hours.'
      : 'Payment successful! Your report is being generated.';

    return successResponse(res, { paymentId: payment.id, status: 'CAPTURED', planType }, successMsg);
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
      logger.warn('[Payment] Webhook for unknown order', { razorpayOrderId });
      return successResponse(res, { received: true, ignored: true }, 'Unknown order');
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
      let reportIdForGeneration = null;
      let assessmentForGeneration = null;
      let profileForGeneration = null;

      if (assessmentId) {
        await prisma.assessment.updateMany({
          where: { id: assessmentId, userId: payment.userId },
          data: { accessLevel: 'PAID', totalQuestions: 30 },
        });

        const existingReport = await prisma.careerReport.findFirst({ where: { assessmentId } });
        if (existingReport) {
          await prisma.careerReport.update({
            where: { id: existingReport.id },
            data: { accessLevel: 'PAID', status: 'GENERATING' },
          });

          await prisma.payment.update({
            where: { id: updatedPayment.id },
            data: { reportId: existingReport.id },
          });

          reportIdForGeneration = existingReport.id;

          [assessmentForGeneration, profileForGeneration] = await Promise.all([
            prisma.assessment.findUnique({
              where: { id: assessmentId },
              include: { questions: true, answers: true },
            }),
            prisma.studentProfile.findUnique({
              where: { userId: payment.userId },
              include: { parentDetail: true },
            }),
          ]);
        }
      }

      const lead = await prisma.lead.findFirst({ where: { userId: payment.userId } });
      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            paymentId: updatedPayment.id,
            status: reportIdForGeneration ? 'premium_report_generating' : 'paid',
          },
        });

        await triggerAutomation('payment_success', {
          leadId:       lead.id,
          userId:       payment.userId,
          amountRupees: PAID_REPORT_PRICE_RUPEES,
          paymentId:    updatedPayment.id,
        });
      }

      analytics.track('payment_success', null, {
        userId: payment.userId,
        amountRupees: PAID_REPORT_PRICE_RUPEES,
        source: 'webhook',
      });

      if (assessmentForGeneration && profileForGeneration && reportIdForGeneration) {
        const { generateReportAsync } = require('./assessment.controller');
        generateReportAsync(assessmentForGeneration, profileForGeneration, reportIdForGeneration);
      }
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
      },
    });

    return successResponse(res, payments);
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

module.exports = { createOrder, verifyPayment, handleWebhook, getPaymentHistory, getPaymentStatus };
