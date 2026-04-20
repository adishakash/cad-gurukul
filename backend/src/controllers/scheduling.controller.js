'use strict';
/**
 * scheduling.controller.js — Phase 10
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles:
 *   Admin endpoints (ADMIN role required):
 *     GET  /scheduling/slots              — list all slots (admin view)
 *     POST /scheduling/slots              — create slots (bulk)
 *     GET  /scheduling/slots/:id          — get single slot
 *     PATCH /scheduling/slots/:id/block   — block a slot
 *     PATCH /scheduling/slots/:id/unblock — unblock a slot
 *     DELETE /scheduling/slots/:id        — delete a free slot
 *     GET  /scheduling/bookings           — list all bookings (admin view)
 *     GET  /scheduling/bookings/:id       — get booking detail
 *     PATCH /scheduling/bookings/:id/status  — update booking status
 *     PATCH /scheduling/bookings/:id/meet-link — set/update meet link
 *     POST  /scheduling/bookings/:id/send-meet — send meet details email
 *
 *   Public endpoint (token-auth only):
 *     GET  /scheduling/available-slots    — list available slots for customer
 *     POST /scheduling/book               — book a specific slot (customer)
 */

const crypto  = require('crypto');
const prisma  = require('../config/database');
const logger  = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/helpers');
const schedulingService = require('../services/scheduling/schedulingService');
const googleMeetService  = require('../services/scheduling/googleMeetService');
const {
  sendMeetDetailsEmail,
  sendAdminNewBookingNotification,
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
} = require('../services/email/emailService');

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Slot management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /scheduling/slots
 * Body: { slots: [{ date, startTime, endTime, label, notes? }] }
 */
const createSlots = async (req, res) => {
  try {
    const rawSlots = req.body.slots;

    // Parse date strings to Date objects (midnight UTC)
    const slots = rawSlots.map((s) => ({
      ...s,
      date: new Date(s.date + 'T00:00:00.000Z'),
    }));

    const created = await schedulingService.createSlots(slots);
    return successResponse(res, { created, count: created.length }, `${created.length} slot(s) created`, 201);
  } catch (err) {
    logger.error('[Scheduling] createSlots error', { error: err.message });
    if (err.code === 'P2002') {
      return errorResponse(res, 'One or more slots conflict with existing entries', 409, 'SLOT_CONFLICT');
    }
    return errorResponse(res, 'Failed to create slots', 500);
  }
};

/**
 * GET /scheduling/slots
 * Query: from, to, status (all|available|booked|blocked), page, limit
 */
const listAdminSlots = async (req, res) => {
  try {
    const { from, to, status, page, limit } = req.query;
    const fromDate = from ? new Date(from + 'T00:00:00.000Z') : undefined;
    const toDate   = to   ? new Date(to   + 'T23:59:59.999Z') : undefined;

    const slots = await schedulingService.getAdminSlots({
      from:   fromDate,
      to:     toDate,
      status: status === 'all' ? undefined : status,
    });

    return successResponse(res, { slots, count: slots.length });
  } catch (err) {
    logger.error('[Scheduling] listAdminSlots error', { error: err.message });
    return errorResponse(res, 'Failed to list slots', 500);
  }
};

/**
 * GET /scheduling/slots/:id
 */
const getSlot = async (req, res) => {
  try {
    const slot = await schedulingService.getSlotById(req.params.id);
    if (!slot) return errorResponse(res, 'Slot not found', 404, 'NOT_FOUND');
    return successResponse(res, { slot });
  } catch (err) {
    logger.error('[Scheduling] getSlot error', { error: err.message });
    return errorResponse(res, 'Failed to get slot', 500);
  }
};

/**
 * PATCH /scheduling/slots/:id/block
 */
const blockSlot = async (req, res) => {
  try {
    const slot = await schedulingService.blockSlot(req.params.id);
    return successResponse(res, { slot }, 'Slot blocked');
  } catch (err) {
    if (err.code === 'NOT_FOUND')      return errorResponse(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'ALREADY_BOOKED') return errorResponse(res, err.message, 409, 'ALREADY_BOOKED');
    logger.error('[Scheduling] blockSlot error', { error: err.message });
    return errorResponse(res, 'Failed to block slot', 500);
  }
};

/**
 * PATCH /scheduling/slots/:id/unblock
 */
const unblockSlot = async (req, res) => {
  try {
    const slot = await schedulingService.unblockSlot(req.params.id);
    return successResponse(res, { slot }, 'Slot unblocked');
  } catch (err) {
    if (err.code === 'NOT_FOUND') return errorResponse(res, err.message, 404, 'NOT_FOUND');
    logger.error('[Scheduling] unblockSlot error', { error: err.message });
    return errorResponse(res, 'Failed to unblock slot', 500);
  }
};

/**
 * DELETE /scheduling/slots/:id
 */
const deleteSlot = async (req, res) => {
  try {
    await schedulingService.deleteSlot(req.params.id);
    return successResponse(res, null, 'Slot deleted');
  } catch (err) {
    if (err.code === 'NOT_FOUND')    return errorResponse(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'SLOT_BOOKED')  return errorResponse(res, err.message, 409, 'SLOT_BOOKED');
    logger.error('[Scheduling] deleteSlot error', { error: err.message });
    return errorResponse(res, 'Failed to delete slot', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Booking management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /scheduling/bookings
 * Query: page, limit, status, search
 */
const listBookings = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const result = await schedulingService.listBookings({
      page:   parseInt(page)  || 1,
      limit:  parseInt(limit) || 30,
      status: status || undefined,
      search: search || undefined,
    });
    return successResponse(res, result);
  } catch (err) {
    logger.error('[Scheduling] listBookings error', { error: err.message });
    return errorResponse(res, 'Failed to list bookings', 500);
  }
};

/**
 * GET /scheduling/bookings/:id
 */
const getBooking = async (req, res) => {
  try {
    const booking = await prisma.consultationBooking.findUnique({
      where:   { id: req.params.id },
      include: {
        user: {
          select: {
            email: true,
            studentProfile: {
              select: { fullName: true, mobileNumber: true },
            },
          },
        },
        availabilitySlot: true,
      },
    });
    if (!booking) return errorResponse(res, 'Booking not found', 404, 'NOT_FOUND');
    return successResponse(res, { booking });
  } catch (err) {
    logger.error('[Scheduling] getBooking error', { error: err.message });
    return errorResponse(res, 'Failed to get booking', 500);
  }
};

/**
 * PATCH /scheduling/bookings/:id/status
 * Body: { status, meetingNotes? }
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { status, meetingNotes } = req.body;
    const data = { status };
    if (meetingNotes !== undefined) data.meetingNotes = meetingNotes;

    const booking = await prisma.consultationBooking.update({
      where: { id: req.params.id },
      data,
    });
    return successResponse(res, { booking }, 'Booking status updated');
  } catch (err) {
    if (err.code === 'P2025') return errorResponse(res, 'Booking not found', 404, 'NOT_FOUND');
    logger.error('[Scheduling] updateBookingStatus error', { error: err.message });
    return errorResponse(res, 'Failed to update booking status', 500);
  }
};

/**
 * PATCH /scheduling/bookings/:id/meet-link
 * Body: { meetLink }
 * Admin can manually set or override the Meet link.
 */
const setMeetLink = async (req, res) => {
  try {
    const { meetLink } = req.body;
    await schedulingService.adminSetMeetLink(req.params.id, meetLink);
    return successResponse(res, null, 'Meet link updated');
  } catch (err) {
    if (err.code === 'P2025') return errorResponse(res, 'Booking not found', 404, 'NOT_FOUND');
    logger.error('[Scheduling] setMeetLink error', { error: err.message });
    return errorResponse(res, 'Failed to set meet link', 500);
  }
};

/**
 * POST /scheduling/bookings/:id/send-meet
 * Admin manually triggers sending the meet-details email to the student.
 */
const sendMeetEmail = async (req, res) => {
  try {
    const booking = await prisma.consultationBooking.findUnique({
      where:   { id: req.params.id },
      include: {
        user: {
          select: {
            email: true,
            studentProfile: {
              select: {
                fullName: true,
                parentDetail: { select: { parentName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!booking) return errorResponse(res, 'Booking not found', 404, 'NOT_FOUND');

    const meetLink = booking.googleMeetLink || booking.meetingLink;
    if (!meetLink) {
      return errorResponse(res, 'No meet link set for this booking. Please set a meet link first.', 422, 'NO_MEET_LINK');
    }

    const studentName = booking.user?.studentProfile?.fullName || booking.user?.email?.split('@')[0] || 'Student';
    const parentEmail = booking.user?.studentProfile?.parentDetail?.email;
    const parentName  = booking.user?.studentProfile?.parentDetail?.parentName;

    const scheduledDateStr = booking.scheduledDate
      ? schedulingService.formatDateIST(booking.scheduledDate)
      : (booking.meetingDate ? schedulingService.formatDateIST(booking.meetingDate) : 'To be confirmed');
    const scheduledTimeStr = booking.scheduledStartTime && booking.scheduledEndTime
      ? schedulingService.formatTimeRange(booking.scheduledStartTime, booking.scheduledEndTime)
      : (booking.selectedSlot || 'To be confirmed');

    const emailPayload = {
      counsellorName:    booking.counsellorName,
      counsellorContact: booking.counsellorContact,
      meetLink,
      scheduledDateStr,
      scheduledTimeStr,
      bookingId:         booking.id,
    };

    // Student email
    if (booking.user?.email) {
      sendMeetDetailsEmail({ to: booking.user.email, name: studentName, studentName, ...emailPayload })
        .catch((e) => logger.warn('[Scheduling] Student meet email failed', { error: e.message }));
    }

    // Parent email
    if (parentEmail) {
      sendMeetDetailsEmail({
        to:          parentEmail,
        name:        parentName || `Parent of ${studentName}`,
        studentName,
        isParent:    true,
        ...emailPayload,
      }).catch((e) => logger.warn('[Scheduling] Parent meet email failed', { error: e.message }));
    }

    // Mark sent timestamp
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data:  { meetLinkSentAt: new Date() },
    });

    return successResponse(res, null, 'Meet details email dispatched');
  } catch (err) {
    logger.error('[Scheduling] sendMeetEmail error', { error: err.message });
    return errorResponse(res, 'Failed to send meet details email', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER — Slot selection (public, token-auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /scheduling/available-slots
 * Public endpoint — no auth required.
 * Returns upcoming available slots (not booked, not blocked).
 */
const getAvailableSlots = async (req, res) => {
  try {
    const slots = await schedulingService.getAvailableSlots({ limit: 60 });
    return successResponse(res, { slots, count: slots.length });
  } catch (err) {
    logger.error('[Scheduling] getAvailableSlots error', { error: err.message });
    return errorResponse(res, 'Failed to load available slots', 500);
  }
};

/**
 * POST /scheduling/book
 * Public endpoint — authenticated via booking token (no JWT needed).
 * Body: { token, slotId }
 *
 * Flow:
 *  1. Validate token → find ConsultationBooking
 *  2. Atomically claim the AvailabilitySlot
 *  3. Create Google Meet event → store link
 *  4. Fire confirmation + admin notification emails
 */
const bookSlot = async (req, res) => {
  try {
    const { token, slotId } = req.body;

    // ── 1. Resolve booking from token ────────────────────────────────────────
    if (!token || typeof token !== 'string' || token.length < 32) {
      return errorResponse(res, 'Invalid booking token', 400, 'INVALID_TOKEN');
    }

    const booking = await prisma.consultationBooking.findUnique({
      where: { slotToken: token },
    });

    if (!booking) {
      return errorResponse(res, 'Invalid or expired booking link', 404, 'NOT_FOUND');
    }

    // ── Idempotency: already booked a date-specific slot? ────────────────────
    if (booking.scheduledDate && booking.availabilitySlot) {
      // Already booked this slot type
      const slot = await schedulingService.getSlotById(booking.availabilitySlot.id).catch(() => null);
      return successResponse(res, {
        alreadyBooked:     true,
        slot:              slot || null,
        scheduledDateStr:  schedulingService.formatDateIST(booking.scheduledDate),
        scheduledTimeStr:  booking.scheduledStartTime
          ? schedulingService.formatTimeRange(booking.scheduledStartTime, booking.scheduledEndTime)
          : '',
        googleMeetLink:    booking.googleMeetLink || booking.meetingLink,
        status:            booking.status,
      }, 'Session already booked');
    }

    // ── 2. Atomically claim the slot ─────────────────────────────────────────
    let claimResult;
    try {
      claimResult = await schedulingService.claimSlot(slotId, booking.id);
    } catch (claimErr) {
      if (claimErr.code === 'NOT_FOUND') {
        return errorResponse(res, 'The selected time slot no longer exists', 404, 'NOT_FOUND');
      }
      if (claimErr.code === 'SLOT_UNAVAILABLE') {
        return errorResponse(
          res,
          'This time slot was just taken by someone else. Please choose another slot.',
          409,
          'SLOT_UNAVAILABLE',
        );
      }
      throw claimErr;
    }

    const { slot, scheduledDateStr, scheduledTimeStr } = claimResult;

    // ── 3. Fetch user details for emails ─────────────────────────────────────
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

    const studentName = user?.studentProfile?.fullName || user?.email?.split('@')[0] || 'Student';
    const parentEmail = user?.studentProfile?.parentDetail?.email;
    const parentName  = user?.studentProfile?.parentDetail?.parentName;

    // ── 4. Create Google Meet event ───────────────────────────────────────────
    const meetResult = await googleMeetService.createMeetEvent({
      bookingId:      booking.id,
      studentName,
      studentEmail:   user?.email || '',
      date:           slot.date,
      startTime:      slot.startTime,
      endTime:        slot.endTime,
      counsellorName: booking.counsellorName,
      counsellorEmail: booking.counsellorContact,
    });

    // ── 5. Save Meet link to booking ─────────────────────────────────────────
    await schedulingService.saveMeetLink(booking.id, {
      meetLink: meetResult.meetLink,
      eventId:  meetResult.eventId,
    });

    // ── 6. Confirmation email → student ──────────────────────────────────────
    const emailPayload = {
      counsellorName:    booking.counsellorName,
      counsellorContact: booking.counsellorContact,
      meetLink:          meetResult.meetLink,
      scheduledDateStr,
      scheduledTimeStr,
      bookingId:         booking.id,
    };

    if (user?.email) {
      sendMeetDetailsEmail({ to: user.email, name: studentName, studentName, ...emailPayload })
        .catch((e) => logger.warn('[Scheduling] Student meet email failed', { error: e.message }));
    }

    // ── 7. Confirmation email → parent ───────────────────────────────────────
    if (parentEmail) {
      sendMeetDetailsEmail({
        to:          parentEmail,
        name:        parentName || `Parent of ${studentName}`,
        studentName,
        isParent:    true,
        ...emailPayload,
      }).catch((e) => logger.warn('[Scheduling] Parent meet email failed', { error: e.message }));
    }

    // ── 8. Admin notification ─────────────────────────────────────────────────
    sendAdminNewBookingNotification({
      studentName,
      studentEmail:  user?.email,
      scheduledDateStr,
      scheduledTimeStr,
      bookingId:     booking.id,
      slotId:        slot.id,
    }).catch((e) => logger.warn('[Scheduling] Admin notification failed', { error: e.message }));

    logger.info('[Scheduling] Slot booked successfully', {
      bookingId:    booking.id,
      slotId:       slot.id,
      meetLinkReal: meetResult.isReal,
    });

    return successResponse(res, {
      bookingId:       booking.id,
      slot: {
        id:        slot.id,
        date:      slot.date,
        startTime: slot.startTime,
        endTime:   slot.endTime,
        label:     slot.label,
      },
      scheduledDateStr,
      scheduledTimeStr,
      googleMeetLink:  meetResult.meetLink,
      meetLinkIsReal:  meetResult.isReal,
      counsellorName:  booking.counsellorName,
      counsellorContact: booking.counsellorContact,
      status:          'meeting_scheduled',
    }, 'Session booked! Meeting details have been sent to your email.');
  } catch (err) {
    logger.error('[Scheduling] bookSlot error', { error: err.message, stack: err.stack });
    return errorResponse(res, 'Failed to book slot. Please try again.', 500);
  }
};

module.exports = {
  // Admin
  createSlots,
  listAdminSlots,
  getSlot,
  blockSlot,
  unblockSlot,
  deleteSlot,
  listBookings,
  getBooking,
  updateBookingStatus,
  setMeetLink,
  sendMeetEmail,
  // Customer
  getAvailableSlots,
  bookSlot,
};
