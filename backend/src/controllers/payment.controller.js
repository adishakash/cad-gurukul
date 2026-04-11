'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');

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

    // Prevent duplicate payment for already-paid report
    const existingPayment = await prisma.payment.findFirst({
      where: { userId: req.user.id, status: 'CAPTURED' },
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
    if (assessmentId) {
      await prisma.assessment.updateMany({
        where: { id: assessmentId, userId: req.user.id },
        data: { accessLevel: 'PAID', totalQuestions: 30 },
      });

      // Create or upgrade report record
      const existingReport = await prisma.careerReport.findFirst({
        where: { assessmentId },
      });

      if (existingReport) {
        await prisma.careerReport.update({
          where: { id: existingReport.id },
          data: { accessLevel: 'PAID', status: 'PENDING' },
        });

        await prisma.payment.update({
          where: { id: updatedPayment.id },
          data: { reportId: existingReport.id },
        });
      }
    }

    logger.info('[Payment] Payment verified', { paymentId: payment.id, razorpayPaymentId });

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

module.exports = { createOrder, verifyPayment, getPaymentHistory };
