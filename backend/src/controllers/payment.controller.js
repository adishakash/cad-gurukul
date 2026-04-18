'use strict';
const crypto = require('crypto');
const prisma = require('../config/database');
const razorpayService = require('../services/payment/razorpayService');
const { successResponse, errorResponse, rupeesToPaise } = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config');
const { triggerAutomation } = require('../services/automation/automationService');
const analytics = require('../services/analytics/analyticsService');
const { sendConsultationSlotEmail } = require('../services/email/emailService');
const { getEffectiveChargeAmount } = require('../utils/testPricing');

// ── Value Ladder pricing ─────────────────────────────────────────────────────
const PLAN_PRICES = {
  standard:     499,    // Full report — stream + career suggestions
  premium:      1999,   // Deep AI analysis — personalised roadmap + subject strategy
  consultation: 9999,   // 1:1 Career Blueprint Session with Adish Gupta
};

// Back-compat: keep the old constant so webhook path doesn't break
const PAID_REPORT_PRICE_RUPEES = PLAN_PRICES.standard;

const getAmountRupeesForPlan = (planType = 'standard') => PLAN_PRICES[planType] || PAID_REPORT_PRICE_RUPEES;

const getLeadStatusAfterPayment = (planType, hasQueuedReport) => {
  if (planType === 'consultation') return 'counselling_interested';
  return hasQueuedReport ? 'premium_report_generating' : 'paid';
};

const getAutomationEventForPlan = (planType) => {
  if (planType === 'consultation') return 'consultation_booked';
  if (planType === 'premium') return 'premium_ai_purchased';
  return 'payment_success';
};

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
    const amountPaise  = rupeesToPaise(amountRupees);

    // ── Test pricing override ─────────────────────────────────────────────────
    // In PAYMENT_TEST_MODE the charge sent to Razorpay is reduced (₹1/₹2/₹3).
    // The DB record always stores the real catalog price (amountPaise).
    const { chargeAmountPaise, isTestMode } = getEffectiveChargeAmount(amountPaise);
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
          assessmentId: assessmentId || null,
          planType,
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
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'payment_pending', planType },
      });
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
    const amountRupees = getAmountRupeesForPlan(planType);

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
      const nextStatus = getLeadStatusAfterPayment(planType, Boolean(reportIdForGeneration));

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
      const automationEvent = getAutomationEventForPlan(planType);

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

    // ─── Consultation: create booking + send slot-selection email ─────────────
    if (planType === 'consultation') {
      // Run async so we don't block the response — errors are caught internally
      _createConsultationBookingAndSendEmail({
        userId:    req.user.id,
        paymentId: updatedPayment.id,
        leadId:    lead?.id || null,
      }).catch((err) =>
        logger.error('[Payment] Consultation booking creation failed', { error: err.message }),
      );
    }

    const successMsg = planType === 'consultation'
      ? 'Booking confirmed! Check your email to select your preferred session slot.'
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
          const netAmountPaise   = testLink.testNetAmountPaise ?? testLink.feeAmountPaise;
          const discountAmountPaise = grossAmountPaise - netAmountPaise;

          await createCcSaleAndCommission({
            ccUserId:          testLink.ccUserId,
            testLinkId:        testLink.id,
            paymentId:         razorpayPaymentId,
            razorpayPaymentId,
            grossAmountPaise,
            discountAmountPaise,
            netAmountPaise,
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
        const netAmountPaise   = joiningLink.joiningNetAmountPaise ?? joiningLink.feeAmountPaise;
        const discountAmountPaise = grossAmountPaise - netAmountPaise;

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
      const amountRupees = getAmountRupeesForPlan(planType);
      let reportIdForGeneration = null;
      let assessmentForGeneration = null;
      let profileForGeneration = null;

      if (planType !== 'consultation' && assessmentId) {
        await prisma.assessment.updateMany({
          where: { id: assessmentId, userId: payment.userId },
          data: { accessLevel: 'PAID', totalQuestions: 30 },
        });

        const existingReport = await prisma.careerReport.findFirst({ where: { assessmentId } });
        if (existingReport) {
          await prisma.careerReport.update({
            where: { id: existingReport.id },
            data: { accessLevel: 'PAID', status: 'GENERATING', reportType: planType },
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
        const nextStatus = getLeadStatusAfterPayment(planType, Boolean(reportIdForGeneration));

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            paymentId: updatedPayment.id,
            planType,
            status: nextStatus,
            ...(planType === 'consultation' ? { counsellingInterested: true } : {}),
          },
        });

        await triggerAutomation(getAutomationEventForPlan(planType), {
          leadId:       lead.id,
          userId:       payment.userId,
          planType,
          amountRupees,
          paymentId:    updatedPayment.id,
        });
      }

      analytics.track('payment_success', null, {
        userId: payment.userId,
        planType,
        amountRupees,
        source: 'webhook',
      });

      if (assessmentForGeneration && profileForGeneration && reportIdForGeneration) {
        const { generateReportAsync } = require('./assessment.controller');
        generateReportAsync(assessmentForGeneration, profileForGeneration, reportIdForGeneration, planType);
      }

      // ─── Consultation: create booking + send slot-selection email ───────────
      // This mirrors the verifyPayment path.  The idempotency guard inside the
      // helper ensures it's safe even if both paths fire for the same payment.
      if (planType === 'consultation') {
        _createConsultationBookingAndSendEmail({
          userId:    payment.userId,
          paymentId: updatedPayment.id,
          leadId:    lead?.id || null,
        }).catch((err) =>
          logger.error('[Payment] Webhook: Consultation booking creation failed', { error: err.message }),
        );
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

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION BOOKING HELPER (private, fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a ConsultationBooking record and sends slot-selection emails to the
 * student and (if present) their parent.  Called immediately after a ₹9,999
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
      status:    'slot_mail_sent',
    },
  });

  // Append timeline event
  if (leadId) {
    await prisma.leadEvent.create({
      data: {
        id:       crypto.randomUUID(),
        leadId,
        event:    'consultation_slot_mail_sent',
        metadata: { bookingId: booking.id },
      },
    }).catch((err) =>
      logger.warn('[Payment] ConsultationBooking LeadEvent failed', { error: err.message }),
    );
  }

  // Fetch user + parent for email sending
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      studentProfile: {
        select: {
          fullName: true,
          parentDetail: { select: { parentName: true, email: true } },
        },
      },
    },
  });

  const studentName = user?.studentProfile?.fullName
    || user?.email?.split('@')[0]
    || 'Student';
  const parentEmail = user?.studentProfile?.parentDetail?.email;
  const parentName  = user?.studentProfile?.parentDetail?.parentName;

  const emailArgs = {
    slotToken,
    counsellorName:      booking.counsellorName,
    counsellorExpertise: booking.counsellorExpertise,
    counsellorContact:   booking.counsellorContact,
  };

  // Send to student
  if (user?.email) {
    await sendConsultationSlotEmail({
      to:   user.email,
      name: studentName,
      ...emailArgs,
    }).catch((err) =>
      logger.warn('[Payment] Slot-selection email to student failed', { error: err.message }),
    );
  }

  // Send to parent
  if (parentEmail) {
    await sendConsultationSlotEmail({
      to:          parentEmail,
      name:        parentName || `Parent of ${studentName}`,
      isParent:    true,
      studentName,
      ...emailArgs,
    }).catch((err) =>
      logger.warn('[Payment] Slot-selection email to parent failed', { error: err.message }),
    );
  }

  logger.info('[Payment] ConsultationBooking created + slot email sent', {
    bookingId: booking.id,
    userId,
    studentEmail: user?.email,
    hasParentEmail: Boolean(parentEmail),
  });

  return booking;
}

module.exports = { createOrder, verifyPayment, handleWebhook, getPaymentHistory, getPaymentStatus };
