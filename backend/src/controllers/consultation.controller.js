'use strict';

const crypto = require('crypto');
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const {
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
  sendConsultationSlotEmail,
} = require('../services/email/emailService');
const {
  AVAILABILITY_WINDOW_DAYS,
  listAvailableSlots,
  assertSlotAvailability,
  buildMeetingRoomName,
  buildMeetingLink,
  formatSlotDateTime,
  formatSlotTimeRange,
  inferLegacySlotCode,
} = require('../services/consultation/consultationSchedulingService');

const RESEND_COOLDOWN_MS = 30 * 60 * 1000;

function isValidToken(token) {
  return typeof token === 'string' && token.length >= 32;
}

async function loadBookingContacts(userId) {
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

  const studentName = user?.studentProfile?.fullName || user?.email?.split('@')[0] || 'Student';

  return {
    user,
    studentName,
    parentEmail: user?.studentProfile?.parentDetail?.email || null,
    parentName: user?.studentProfile?.parentDetail?.parentName || null,
  };
}

async function appendLeadEvent(leadId, event, metadata) {
  if (!leadId) return;

  await prisma.leadEvent.create({
    data: {
      id: crypto.randomUUID(),
      leadId,
      event,
      metadata,
    },
  }).catch((err) => {
    logger.warn('[Consultation] LeadEvent append failed', { error: err.message, event, leadId });
  });
}

async function sendSchedulingEmailForBooking(booking, userEmail, studentName) {
  if (!userEmail) {
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        status: 'booking_confirmed',
        schedulingEmailSentAt: null,
        schedulingEmailError: 'Student email unavailable',
      },
    });

    return {
      delivered: false,
      error: 'Student email unavailable',
    };
  }

  try {
    await sendConsultationSlotEmail({
      to: userEmail,
      name: studentName,
      slotToken: booking.slotToken,
      counsellorName: booking.counsellorName,
      counsellorExpertise: booking.counsellorExpertise,
      counsellorContact: booking.counsellorContact,
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

    return { delivered: true, error: null };
  } catch (err) {
    await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        status: 'booking_confirmed',
        schedulingEmailSentAt: null,
        schedulingEmailError: err.message,
      },
    }).catch(() => {});

    logger.warn('[Consultation] Scheduling email failed', {
      bookingId: booking.id,
      error: err.message,
    });

    return { delivered: false, error: err.message };
  }
}

async function getAvailability(req, res) {
  try {
    const token = req.query.token;

    if (!isValidToken(token)) {
      return errorResponse(res, 'Invalid slot selection token', 400, 'INVALID_TOKEN');
    }

    const booking = await prisma.consultationBooking.findUnique({
      where: { slotToken: token },
      select: {
        id: true,
        status: true,
        counsellorName: true,
        counsellorExpertise: true,
        counsellorContact: true,
        schedulingEmailSentAt: true,
        schedulingEmailError: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        meetingLink: true,
      },
    });

    if (!booking) {
      return errorResponse(res, 'Invalid or expired slot selection link', 404, 'NOT_FOUND');
    }

    const availability = await listAvailableSlots({
      from: new Date(),
      days: AVAILABILITY_WINDOW_DAYS,
      excludeBookingId: booking.id,
    });

    return successResponse(res, {
      booking,
      availability,
      availabilityWindowDays: AVAILABILITY_WINDOW_DAYS,
    });
  } catch (err) {
    logger.error('[Consultation] getAvailability error', { error: err.message });
    throw err;
  }
}

async function selectSlot(req, res) {
  try {
    const { token, slotStartAt } = req.body;

    if (!isValidToken(token)) {
      return errorResponse(res, 'Invalid slot selection token', 400, 'INVALID_TOKEN');
    }

    if (!slotStartAt || typeof slotStartAt !== 'string') {
      return errorResponse(res, 'Please choose an exact date and time slot.', 400, 'INVALID_SLOT');
    }

    const booking = await prisma.consultationBooking.findUnique({
      where: { slotToken: token },
    });

    if (!booking) {
      return errorResponse(res, 'Invalid or expired slot selection link', 404, 'NOT_FOUND');
    }

    const slot = await assertSlotAvailability(slotStartAt, { excludeBookingId: booking.id }).catch((err) => {
      if (err.code === 'INVALID_SLOT') {
        return null;
      }
      throw err;
    });

    if (!slot) {
      return errorResponse(
        res,
        'Selected slot is outside the available consultation schedule.',
        400,
        'INVALID_SLOT',
      );
    }

    if (booking.scheduledStartAt) {
      const alreadySelected = new Date(booking.scheduledStartAt).toISOString() === slot.scheduledStartAt.toISOString();
      if (alreadySelected) {
        return successResponse(
          res,
          {
            alreadySelected: true,
            booking: {
              id: booking.id,
              status: booking.status,
              scheduledStartAt: booking.scheduledStartAt,
              scheduledEndAt: booking.scheduledEndAt,
              meetingLink: booking.meetingLink,
              counsellorName: booking.counsellorName,
              counsellorContact: booking.counsellorContact,
            },
          },
          'Your consultation slot is already confirmed.',
        );
      }

      return errorResponse(
        res,
        'You have already selected your consultation slot. Please contact support to reschedule.',
        409,
        'SLOT_ALREADY_SELECTED',
        { scheduledStartAt: booking.scheduledStartAt },
      );
    }

    const roomName = buildMeetingRoomName(booking.id, booking.userId);
    const meetingLink = buildMeetingLink(roomName);

    const updatedBooking = await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        selectedSlot: inferLegacySlotCode(slot.scheduledStartAt),
        slotSelectedAt: new Date(),
        scheduledStartAt: slot.scheduledStartAt,
        scheduledEndAt: slot.scheduledEndAt,
        scheduledTimezone: 'Asia/Kolkata',
        meetingProvider: 'JITSI',
        meetingRoomName: roomName,
        meetingConfirmedAt: new Date(),
        status: 'meeting_scheduled',
        meetingDate: slot.scheduledStartAt,
        meetingLink,
      },
    });

    await appendLeadEvent(booking.leadId, 'consultation_slot_selected', {
      bookingId: booking.id,
      scheduledStartAt: slot.scheduledStartAt.toISOString(),
      scheduledEndAt: slot.scheduledEndAt.toISOString(),
      meetingLink,
    });
    await appendLeadEvent(booking.leadId, 'consultation_meeting_scheduled', {
      bookingId: booking.id,
      scheduledStartAt: slot.scheduledStartAt.toISOString(),
      scheduledEndAt: slot.scheduledEndAt.toISOString(),
      meetingLink,
    });

    const { user, studentName, parentEmail, parentName } = await loadBookingContacts(booking.userId);

    if (user?.email) {
      sendSlotConfirmationEmail({
        to: user.email,
        name: studentName,
        scheduledStartAt: slot.scheduledStartAt,
        scheduledEndAt: slot.scheduledEndAt,
        counsellorName: updatedBooking.counsellorName,
        counsellorContact: updatedBooking.counsellorContact,
        meetingLink,
        meetingProvider: updatedBooking.meetingProvider,
      }).catch((err) =>
        logger.warn('[Consultation] Student confirmation email failed', { error: err.message }),
      );
    }

    if (parentEmail) {
      sendSlotConfirmationEmail({
        to: parentEmail,
        name: parentName || `Parent of ${studentName}`,
        scheduledStartAt: slot.scheduledStartAt,
        scheduledEndAt: slot.scheduledEndAt,
        counsellorName: updatedBooking.counsellorName,
        counsellorContact: updatedBooking.counsellorContact,
        meetingLink,
        meetingProvider: updatedBooking.meetingProvider,
        isParent: true,
        studentName,
      }).catch((err) =>
        logger.warn('[Consultation] Parent confirmation email failed', { error: err.message }),
      );
    }

    sendAdminSlotNotification({
      studentName,
      studentEmail: user?.email,
      bookingId: booking.id,
      scheduledStartAt: slot.scheduledStartAt,
      scheduledEndAt: slot.scheduledEndAt,
      meetingLink,
      meetingProvider: updatedBooking.meetingProvider,
    }).catch((err) =>
      logger.warn('[Consultation] Admin notification email failed', { error: err.message }),
    );

    logger.info('[Consultation] Exact slot selected', {
      bookingId: booking.id,
      userId: booking.userId,
      scheduledStartAt: slot.scheduledStartAt.toISOString(),
    });

    return successResponse(
      res,
      {
        booking: {
          id: updatedBooking.id,
          status: updatedBooking.status,
          scheduledStartAt: updatedBooking.scheduledStartAt,
          scheduledEndAt: updatedBooking.scheduledEndAt,
          meetingLink: updatedBooking.meetingLink,
          counsellorName: updatedBooking.counsellorName,
          counsellorContact: updatedBooking.counsellorContact,
          meetingProvider: updatedBooking.meetingProvider,
          scheduledLabel: formatSlotDateTime(slot.scheduledStartAt),
          scheduledTimeRange: formatSlotTimeRange(slot.scheduledStartAt, slot.scheduledEndAt),
        },
      },
      'Consultation slot confirmed. Your meeting link is now ready.',
    );
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') {
      return errorResponse(res, err.message, 409, 'SLOT_UNAVAILABLE');
    }

    logger.error('[Consultation] selectSlot error', { error: err.message });
    throw err;
  }
}

async function getMyBooking(req, res) {
  try {
    const booking = await prisma.consultationBooking.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        selectedSlot: true,
        slotSelectedAt: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        scheduledTimezone: true,
        meetingProvider: true,
        meetingConfirmedAt: true,
        schedulingEmailSentAt: true,
        schedulingEmailError: true,
        counsellorName: true,
        counsellorExpertise: true,
        counsellorContact: true,
        meetingDate: true,
        meetingLink: true,
        meetingNotes: true,
        lastResendAt: true,
        resendCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return successResponse(res, booking);
  } catch (err) {
    logger.error('[Consultation] getMyBooking error', { error: err.message });
    throw err;
  }
}

async function resendSlotEmail(req, res) {
  try {
    const booking = await prisma.consultationBooking.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!booking) {
      return errorResponse(res, 'No consultation booking found for your account.', 404, 'NOT_FOUND');
    }

    if (booking.scheduledStartAt || booking.status === 'meeting_scheduled') {
      return errorResponse(
        res,
        'Your meeting is already scheduled. Please check your confirmation email for the link.',
        400,
        'MEETING_ALREADY_SCHEDULED',
      );
    }

    if (booking.lastResendAt) {
      const elapsed = Date.now() - new Date(booking.lastResendAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const minutesLeft = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 60000);
        return errorResponse(
          res,
          `Please wait ${minutesLeft} more minute${minutesLeft !== 1 ? 's' : ''} before requesting another resend.`,
          429,
          'RESEND_COOLDOWN',
          { nextResendAt: new Date(new Date(booking.lastResendAt).getTime() + RESEND_COOLDOWN_MS).toISOString() },
        );
      }
    }

    const { user, studentName } = await loadBookingContacts(req.user.id);
    const delivery = await sendSchedulingEmailForBooking(booking, user?.email, studentName);

    const refreshedBooking = await prisma.consultationBooking.findUnique({
      where: { id: booking.id },
      select: { lastResendAt: true, schedulingEmailSentAt: true, resendCount: true, status: true, schedulingEmailError: true },
    });

    const updatedBooking = await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: {
        resendCount: { increment: 1 },
      },
      select: { lastResendAt: true, resendCount: true, schedulingEmailSentAt: true, status: true, schedulingEmailError: true },
    });

    await appendLeadEvent(booking.leadId, delivery.delivered ? 'consultation_slot_email_resent' : 'consultation_slot_email_failed', {
      resendCount: updatedBooking.resendCount,
      delivered: delivery.delivered,
      error: delivery.error,
    });

    const nextResendAt = refreshedBooking?.lastResendAt
      ? new Date(new Date(refreshedBooking.lastResendAt).getTime() + RESEND_COOLDOWN_MS).toISOString()
      : null;

    return successResponse(
      res,
      {
        resentAt: refreshedBooking?.lastResendAt || null,
        delivered: delivery.delivered,
        status: updatedBooking.status,
        schedulingEmailSentAt: updatedBooking.schedulingEmailSentAt,
        schedulingEmailError: updatedBooking.schedulingEmailError,
        nextResendAt,
      },
      delivery.delivered
        ? 'Scheduling email resent successfully. Check your inbox.'
        : 'Scheduling email attempt failed. Please verify your email setup or contact support.',
    );
  } catch (err) {
    logger.error('[Consultation] resendSlotEmail error', { error: err.message });
    throw err;
  }
}

async function recoverConsultationBooking(req, res) {
  try {
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

    const existingBooking = await prisma.consultationBooking.findUnique({
      where: { paymentId: payment.id },
    });

    if (existingBooking) {
      logger.info('[Consultation] Recover delegated to resend', {
        userId: req.user.id,
        bookingId: existingBooking.id,
      });
      return resendSlotEmail(req, res);
    }

    const lead = await prisma.lead.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const slotToken = crypto.randomBytes(32).toString('hex');

    const booking = await prisma.consultationBooking.create({
      data: {
        id: crypto.randomUUID(),
        userId: req.user.id,
        paymentId: payment.id,
        leadId: lead?.id || null,
        slotToken,
        status: 'booking_confirmed',
      },
    });

    const { user, studentName } = await loadBookingContacts(req.user.id);
    const delivery = await sendSchedulingEmailForBooking(booking, user?.email, studentName);

    await appendLeadEvent(lead?.id, 'consultation_booking_recovered', {
      bookingId: booking.id,
      delivered: delivery.delivered,
      error: delivery.error,
    });

    return successResponse(
      res,
      {
        recovered: true,
        bookingId: booking.id,
        delivered: delivery.delivered,
        schedulingEmailError: delivery.error,
      },
      delivery.delivered
        ? 'Booking created and scheduling email sent. Please check your inbox.'
        : 'Booking created, but the scheduling email could not be delivered.',
      201,
    );
  } catch (err) {
    logger.error('[Consultation] recoverConsultationBooking error', { error: err.message });
    throw err;
  }
}

async function testSlotEmail(req, res) {
  try {
    const targetEmail = req.body?.to || req.admin?.email || req.user?.email;

    if (!targetEmail) {
      return errorResponse(res, 'No target email address. Pass { to: "email@example.com" } in request body.', 400, 'NO_EMAIL');
    }

    const syntheticToken = crypto.randomBytes(32).toString('hex');
    await sendConsultationSlotEmail({
      to: targetEmail,
      name: 'Test Admin',
      slotToken: syntheticToken,
      counsellorName: 'Adish Gupta',
      counsellorExpertise: 'Career Guidance Specialist | 10+ years | IIT Alumni',
      counsellorContact: 'contact@cadgurukul.com',
    });

    return successResponse(
      res,
      { to: targetEmail, delivered: true, syntheticToken },
      `Test scheduling email sent to ${targetEmail}.`,
    );
  } catch (err) {
    logger.error('[Consultation] testSlotEmail error', { error: err.message });
    return errorResponse(res, `Email delivery failed: ${err.message}`, 502, 'SMTP_FAILURE');
  }
}

module.exports = {
  getAvailability,
  selectSlot,
  getMyBooking,
  resendSlotEmail,
  recoverConsultationBooking,
  testSlotEmail,
};
