'use strict';
/**
 * Consultation Controller — Phase 7
 * ──────────────────────────────────────────────────────────────────────────
 * Manages the post-payment slot-selection workflow for ₹9,999 consultations.
 *
 * Public endpoint (token-based, no JWT required):
 *   POST /consultation/select-slot  { token, slot }
 *
 * Auth-protected endpoint:
 *   GET  /consultation/my
 */

const crypto = require('crypto');
const prisma  = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger  = require('../utils/logger');
const {
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
} = require('../services/email/emailService');

const VALID_SLOTS = ['morning_9_12', 'afternoon_2_5', 'evening_6_9'];

const SLOT_LABELS = {
  morning_9_12:  'Morning — 9:00 AM to 12:00 PM',
  afternoon_2_5: 'Afternoon — 2:00 PM to 5:00 PM',
  evening_6_9:   'Evening — 6:00 PM to 9:00 PM',
};

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

module.exports = { selectSlot, getMyBooking };
