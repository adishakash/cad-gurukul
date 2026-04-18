'use strict';
/**
 * Consultation Controller — Phase 7
 * ──────────────────────────────────────────────────────────────────────────
 * Manages the post-payment slot-selection workflow for ₹9,999 consultations.
 *
 * Public endpoint (token-based, no JWT required):
 *   POST /consultation/select-slot  { token, slot }
 *
 * Auth-protected endpoints:
 *   GET  /consultation/my
 *   POST /consultation/resend
 */

const crypto = require('crypto');
const prisma  = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger  = require('../utils/logger');
const {
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
  sendConsultationSlotEmail,
} = require('../services/email/emailService');

const VALID_SLOTS = ['morning_9_12', 'afternoon_2_5', 'evening_6_9'];

const SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
};

/** 30-minute minimum between manual resend requests */
const RESEND_COOLDOWN_MS = 30 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /consultation/select-slot
 * Public endpoint — authenticated via secure slot token (no JWT required).
 * Body: { token: string, slot: 'morning_9_12' | 'afternoon_2_5' | 'evening_6_9' }
 *
 * Idempotent: re-selecting the same slot returns 200 with alreadySelected: true.
 * Selecting a different slot when one already exists returns 409.
 */
const selectSlot = async (req, res) => {
  try {
    const { token, slot } = req.body;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!token || typeof token !== 'string' || token.length < 32) {
      return errorResponse(res, 'Invalid slot selection token', 400, 'INVALID_TOKEN');
    }
    if (!slot || !VALID_SLOTS.includes(slot)) {
      return errorResponse(
        res,
        `Invalid slot. Valid values: ${VALID_SLOTS.join(', ')}`,
        400,
        'INVALID_SLOT',
      );
    }

    // ── Look up booking ──────────────────────────────────────────────────────
    const booking = await prisma.consultationBooking.findUnique({
      where: { slotToken: token },
    });

    if (!booking) {
      return errorResponse(res, 'Invalid or expired slot selection link', 404, 'NOT_FOUND');
    }

    // ── Idempotency check ────────────────────────────────────────────────────
    if (booking.selectedSlot) {
      if (booking.selectedSlot === slot) {
        // Same slot re-submitted — safe to return success
        return successResponse(
          res,
          {
            slot,
            slotLabel: SLOT_LABELS[slot],
            status: booking.status,
            alreadySelected: true,
            counsellorName:    booking.counsellorName,
            counsellorContact: booking.counsellorContact,
          },
          'Slot already confirmed. Our team will be in touch with the meeting details.',
        );
      }
      // Different slot — inform user to contact support
      return errorResponse(
        res,
        `You already selected "${SLOT_LABELS[booking.selectedSlot]}". Please contact support to change your slot.`,
        409,
        'SLOT_ALREADY_SELECTED',
        { selectedSlot: booking.selectedSlot },
      );
    }

    // ── Record selection ─────────────────────────────────────────────────────
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        selectedSlot:   slot,
        slotSelectedAt: new Date(),
        status:         'slot_selected',
      },
    });

    // ── Append timeline event ────────────────────────────────────────────────
    if (booking.leadId) {
      await prisma.leadEvent.create({
        data: {
          id:       crypto.randomUUID(),
          leadId:   booking.leadId,
          event:    'consultation_slot_selected',
          metadata: { slot, slotLabel: SLOT_LABELS[slot], bookingId: booking.id },
        },
      }).catch((err) =>
        logger.warn('[Consultation] LeadEvent append failed', { error: err.message }),
      );
    }

    // ── Fetch user + parent for confirmation emails ──────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: booking.userId },
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

    // ── Confirmation email → student (fire-and-forget) ───────────────────────
    if (user?.email) {
      sendSlotConfirmationEmail({
        to:               user.email,
        name:             studentName,
        slot,
        slotLabel:        SLOT_LABELS[slot],
        counsellorName:   booking.counsellorName,
        counsellorContact: booking.counsellorContact,
      }).catch((err) =>
        logger.warn('[Consultation] Student confirmation email failed', { error: err.message }),
      );
    }

    // ── Confirmation email → parent (fire-and-forget) ────────────────────────
    if (parentEmail) {
      sendSlotConfirmationEmail({
        to:               parentEmail,
        name:             parentName || `Parent of ${studentName}`,
        slot,
        slotLabel:        SLOT_LABELS[slot],
        counsellorName:   booking.counsellorName,
        counsellorContact: booking.counsellorContact,
        isParent:         true,
        studentName,
      }).catch((err) =>
        logger.warn('[Consultation] Parent confirmation email failed', { error: err.message }),
      );
    }

    // ── Admin notification (fire-and-forget) ─────────────────────────────────
    sendAdminSlotNotification({
      studentName,
      studentEmail: user?.email,
      slot,
      slotLabel:    SLOT_LABELS[slot],
      bookingId:    booking.id,
    }).catch((err) =>
      logger.warn('[Consultation] Admin notification email failed', { error: err.message }),
    );

    logger.info('[Consultation] Slot selected', {
      bookingId: booking.id,
      slot,
      userId:    booking.userId,
    });

    return successResponse(
      res,
      {
        slot,
        slotLabel:        SLOT_LABELS[slot],
        status:           'slot_selected',
        counsellorName:   booking.counsellorName,
        counsellorContact: booking.counsellorContact,
      },
      'Slot confirmed! Our team will send you the meeting details within 24 hours.',
    );
  } catch (err) {
    logger.error('[Consultation] selectSlot error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /consultation/my
 * Auth-protected. Returns the current user's latest consultation booking (or null).
 * Used by Dashboard to render the ConsultationTimeline.
 */
const getMyBooking = async (req, res) => {
  try {
    const booking = await prisma.consultationBooking.findFirst({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id:                 true,
        status:             true,
        selectedSlot:       true,
        slotSelectedAt:     true,
        counsellorName:     true,
        counsellorExpertise: true,
        counsellorContact:  true,
        meetingDate:        true,
        meetingLink:        true,
        meetingNotes:       true,
        lastResendAt:       true,
        resendCount:        true,
        createdAt:          true,
        updatedAt:          true,
      },
    });

    return successResponse(res, booking);
  } catch (err) {
    logger.error('[Consultation] getMyBooking error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /consultation/resend
 * Auth-protected. Re-sends the slot-selection email to the user (and parent if
 * registered). Rate-limited: 30-minute cooldown between resend requests.
 * Only works while status is 'slot_mail_sent' (slot not yet chosen).
 */
const resendSlotEmail = async (req, res) => {
  try {
    const booking = await prisma.consultationBooking.findFirst({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!booking) {
      return errorResponse(res, 'No consultation booking found for your account.', 404, 'NOT_FOUND');
    }

    // Only resend while waiting for slot selection
    if (booking.status !== 'slot_mail_sent') {
      return errorResponse(
        res,
        'Your slot has already been selected — no resend needed.',
        400,
        'SLOT_ALREADY_SELECTED',
      );
    }

    // Cooldown: 30 minutes since last send (createdAt for initial, lastResendAt thereafter)
    const lastSentAt = booking.lastResendAt || booking.createdAt;
    const elapsed    = Date.now() - new Date(lastSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 60000);
      return errorResponse(
        res,
        `Please wait ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''} before requesting another resend.`,
        429,
        'RESEND_COOLDOWN',
        { nextResendAt: new Date(new Date(lastSentAt).getTime() + RESEND_COOLDOWN_MS).toISOString() },
      );
    }

    // Fetch user + parent email addresses
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
      slotToken:           booking.slotToken,
      counsellorName:      booking.counsellorName,
      counsellorExpertise: booking.counsellorExpertise,
      counsellorContact:   booking.counsellorContact,
    };

    const emailResults = { student: false, parent: false };

    if (user?.email) {
      try {
        await sendConsultationSlotEmail({ to: user.email, name: studentName, ...emailArgs });
        emailResults.student = true;
      } catch (err) {
        logger.warn('[Consultation] Resend: student email failed', { error: err.message });
      }
    }

    if (parentEmail) {
      try {
        await sendConsultationSlotEmail({
          to:          parentEmail,
          name:        parentName || `Parent of ${studentName}`,
          isParent:    true,
          studentName,
          ...emailArgs,
        });
        emailResults.parent = true;
      } catch (err) {
        logger.warn('[Consultation] Resend: parent email failed', { error: err.message });
      }
    }

    // Persist resend record
    const updatedBooking = await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        lastResendAt: new Date(),
        resendCount:  { increment: 1 },
      },
      select: { lastResendAt: true, resendCount: true },
    });

    // Append timeline event (non-fatal)
    if (booking.leadId) {
      prisma.leadEvent.create({
        data: {
          id:       crypto.randomUUID(),
          leadId:   booking.leadId,
          event:    'consultation_slot_email_resent',
          metadata: { resendCount: updatedBooking.resendCount, emailResults },
        },
      }).catch((err) =>
        logger.warn('[Consultation] Resend LeadEvent failed', { error: err.message }),
      );
    }

    logger.info('[Consultation] Slot email resent', {
      bookingId:    booking.id,
      userId:       req.user.id,
      resendCount:  updatedBooking.resendCount,
      emailResults,
    });

    const nextResendAt = new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString();

    return successResponse(
      res,
      { resentAt: updatedBooking.lastResendAt, emailResults, nextResendAt },
      emailResults.student || emailResults.parent
        ? 'Slot-selection email resent successfully. Check your inbox.'
        : 'Resend attempted but email delivery failed. Please contact support.',
    );
  } catch (err) {
    logger.error('[Consultation] resendSlotEmail error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /consultation/recover
 * Auth-protected. Recovery endpoint for legacy users who paid ₹9,999 before the
 * webhook fix — they have a captured payment but no ConsultationBooking row and
 * never received the slot-selection email.
 *
 * Behaviour:
 *  • Finds the user's most recent consultation payment (status=CAPTURED, metadata.planType='consultation')
 *  • If booking already exists for that payment → delegates to resend (with normal cooldown)
 *  • If no booking → creates one and sends the slot-selection email
 */
const recoverConsultationBooking = async (req, res) => {
  try {
    // ── 1. Find the user's consultation payment ──────────────────────────────
    const payment = await prisma.payment.findFirst({
      where: {
        userId: req.user.id,
        status: 'CAPTURED',
        metadata: { path: ['planType'], equals: 'consultation' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return errorResponse(
        res,
        'No consultation payment found on your account. If you believe this is an error, please contact support.',
        404,
        'NO_CONSULTATION_PAYMENT',
      );
    }

    // ── 2. Check if booking already exists for this payment ──────────────────
    const existingBooking = await prisma.consultationBooking.findUnique({
      where: { paymentId: payment.id },
    });

    if (existingBooking) {
      // Booking exists — run the normal resend flow (respect cooldown)
      logger.info('[Consultation] Recover: booking already exists, delegating to resend', {
        userId:    req.user.id,
        bookingId: existingBooking.id,
      });
      return resendSlotEmail(req, res);
    }

    // ── 3. No booking — create one ───────────────────────────────────────────
    const lead = await prisma.lead.findFirst({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const slotToken = crypto.randomBytes(32).toString('hex');

    const booking = await prisma.consultationBooking.create({
      data: {
        id:        crypto.randomUUID(),
        userId:    req.user.id,
        paymentId: payment.id,
        leadId:    lead?.id || null,
        slotToken,
        status:    'slot_mail_sent',
        // counsellorName, counsellorExpertise, counsellorContact all have @default in schema
      },
    });

    // ── 4. Fetch user + parent for email ─────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    const emailResults = { student: false, parent: false };

    if (user?.email) {
      try {
        await sendConsultationSlotEmail({ to: user.email, name: studentName, ...emailArgs });
        emailResults.student = true;
      } catch (err) {
        logger.warn('[Consultation] Recover: student email failed', { error: err.message });
      }
    }

    if (parentEmail) {
      try {
        await sendConsultationSlotEmail({
          to:          parentEmail,
          name:        parentName || `Parent of ${studentName}`,
          isParent:    true,
          studentName,
          ...emailArgs,
        });
        emailResults.parent = true;
      } catch (err) {
        logger.warn('[Consultation] Recover: parent email failed', { error: err.message });
      }
    }

    // ── 5. Append LeadEvent ──────────────────────────────────────────────────
    if (lead?.id) {
      prisma.leadEvent.create({
        data: {
          id:       crypto.randomUUID(),
          leadId:   lead.id,
          event:    'consultation_booking_recovered',
          metadata: { bookingId: booking.id, emailResults },
        },
      }).catch((err) =>
        logger.warn('[Consultation] Recover LeadEvent failed', { error: err.message }),
      );
    }

    logger.info('[Consultation] Legacy booking recovered', {
      userId:    req.user.id,
      bookingId: booking.id,
      paymentId: payment.id,
      emailResults,
    });

    return successResponse(
      res,
      {
        recovered:    true,
        bookingId:    booking.id,
        emailResults,
      },
      emailResults.student || emailResults.parent
        ? 'Booking created and slot-selection email sent! Please check your inbox.'
        : 'Booking created, but email delivery failed. Please contact support at support@cadgurukul.com',
      201,
    );
  } catch (err) {
    logger.error('[Consultation] recoverConsultationBooking error', { error: err.message });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /consultation/test-email  (Admin only)
 * Sends a real slot-selection email using a synthetic token so the team can verify
 * SMTP delivery on staging/production before running a live payment test.
 *
 * Body (optional): { to: "override@email.com" }
 * Defaults to the authenticated admin's own email.
 */
const testSlotEmail = async (req, res) => {
  try {
    const targetEmail = (req.body && req.body.to) ? req.body.to : req.admin?.email;

    if (!targetEmail) {
      return errorResponse(res, 'No target email address. Pass { to: "email@example.com" } in request body.', 400, 'NO_EMAIL');
    }

    const syntheticToken = crypto.randomBytes(32).toString('hex');
    const testArgs = {
      to:                  targetEmail,
      name:                'Test Admin',
      slotToken:           syntheticToken,
      counsellorName:      'Adish Gupta',
      counsellorExpertise: 'Career Guidance Specialist | 10+ years | IIT Alumni',
      counsellorContact:   'adish@cadgurukul.com',
    };

    let delivered = false;
    let errorMsg   = null;
    try {
      await sendConsultationSlotEmail(testArgs);
      delivered = true;
    } catch (err) {
      errorMsg = err.message;
      logger.error('[Consultation] testSlotEmail: delivery failed', { error: err.message });
    }

    logger.info('[Consultation] testSlotEmail called', { to: targetEmail, delivered });

    if (delivered) {
      return successResponse(
        res,
        { to: targetEmail, delivered: true, syntheticToken },
        `Test slot-selection email sent to ${targetEmail}. Check the inbox — the slot link will be non-functional (synthetic token).`,
      );
    } else {
      return errorResponse(
        res,
        `Email delivery FAILED: ${errorMsg}. Check SMTP config (host, port, user, pass) in .env`,
        502,
        'SMTP_FAILURE',
        { smtpError: errorMsg },
      );
    }
  } catch (err) {
    logger.error('[Consultation] testSlotEmail error', { error: err.message });
    throw err;
  }
};

module.exports = { selectSlot, getMyBooking, resendSlotEmail, recoverConsultationBooking, testSlotEmail };

