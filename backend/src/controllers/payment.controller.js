'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');
const { triggerAutomation } = require('../services/automation/automationService');
const analytics = require('../services/analytics/analyticsService');

const PAID_REPORT_PRICE_RUPEES = 499;

/**
 * POST /payments/create-order
 * Creates a Razorpay order and a pending payment record.
 */
const createOrder = async (req, res) => {
  try {
    const { assessmentId } = req.body;

    // Validate assessment belongs to user
    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, userId: req.user.id },
    });

    if (!assessment) {
      return errorResponse(res, 'Assessment not found', 404, 'NOT_FOUND');
    }

    // Prevent duplicate payment for the same assessment
    const existingPayment = await prisma.payment.findFirst({
      where: {
        userId: req.user.id,
        status: 'CAPTURED',
        metadata: { path: ['assessmentId'], equals: assessmentId },
      },
    });

    if (existingPayment) {
      return errorResponse(res, 'Payment already completed for this assessment', 409, 'CONFLICT');
    }

    const amountPaise = rupeesToPaise(PAID_REPORT_PRICE_RUPEES);

    // Create Razorpay order
    const order = await razorpayService.createOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: `cg_${assessmentId.slice(0, 12)}`,
      notes: { userId: req.user.id, assessmentId },
    });

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        amountPaise,
        currency: 'INR',
        status: 'CREATED',
        razorpayOrderId: order.id,
        metadata: { assessmentId },
      },
    });

    // Track analytics + trigger automation
    analytics.track('payment_initiated', req, { userId: req.user.id });

    // Link lead to payment_pending if lead exists
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (lead) {
      await triggerAutomation('payment_initiated', { leadId: lead.id, userId: req.user.id });
    }

    logger.info('[Payment] Order created', { paymentId: payment.id, orderId: order.id });

    return successResponse(res, {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      paymentId: payment.id,
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

    // Upgrade the assessment and report to PAID
    const assessmentId = payment.metadata?.assessmentId;
    let reportIdForGeneration = null;
    let assessmentForGeneration = null;
    let profileForGeneration = null;

    if (assessmentId) {
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
          data: { accessLevel: 'PAID', status: 'GENERATING' },
        });

        await prisma.payment.update({
          where: { id: updatedPayment.id },
          data: { reportId: existingReport.id },
        });

        reportIdForGeneration = existingReport.id;

        // Fetch full assessment + student profile for report regeneration
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

    logger.info('[Payment] Payment verified', { paymentId: payment.id, razorpayPaymentId });

    // ─── Automation hooks post-payment ────────────────────────────────────────
    analytics.track('payment_success', req, {
      userId: req.user.id,
      amountRupees: PAID_REPORT_PRICE_RUPEES,
    });

    // Update lead: status → premium_report_generating (if report queued) or paid, link paymentId
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
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
        userId:       req.user.id,
        amountRupees: PAID_REPORT_PRICE_RUPEES,
        paymentId:    updatedPayment.id,
      });
    }

    // Fire-and-forget premium report generation (updates lead.status → premium_report_ready on completion)
    if (assessmentForGeneration && profileForGeneration && reportIdForGeneration) {
      const { generateReportAsync } = require('./assessment.controller');
      generateReportAsync(assessmentForGeneration, profileForGeneration, reportIdForGeneration);
    }

    return successResponse(res, { paymentId: payment.id, status: 'CAPTURED' }, 'Payment successful! Your full report is being generated.');
  } catch (err) {
    logger.error('[Payment] verifyPayment error', { error: err.message });
    throw err;
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

module.exports = { createOrder, verifyPayment, getPaymentHistory, getPaymentStatus };
