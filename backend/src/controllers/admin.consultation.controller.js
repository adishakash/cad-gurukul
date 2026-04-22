'use strict';

const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const {
  listConsultationCalendar,
  assertSlotAvailability,
  buildMeetingRoomName,
  buildMeetingLink,
  createUtcDateFromIst,
  formatSlotDateTime,
  formatSlotTimeRange,
  inferLegacySlotCode,
} = require('../services/consultation/consultationSchedulingService');
const {
  sendSlotConfirmationEmail,
  sendAdminSlotNotification,
} = require('../services/email/emailService');
const {
  sendReminderForBooking,
  sendFollowUpForBooking,
  sendCounsellingReportForBooking,
} = require('../services/consultation/consultationAutomationService');

async function loadBookingWithContacts(bookingId) {
  return prisma.consultationBooking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          email: true,
          studentProfile: {
            select: {
              fullName: true,
              parentDetail: { select: { email: true, parentName: true } },
            },
          },
        },
      },
      lead: {
        select: { reportId: true },
      },
    },
  });
}

async function listConsultations(req, res) {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date();
    const days = Number.parseInt(req.query.days, 10) || 14;
    const calendar = await listConsultationCalendar({ from, days });
    return successResponse(res, calendar);
  } catch (err) {
    logger.error('[AdminConsultation] listConsultations error', { error: err.message });
    throw err;
  }
}

async function createAvailabilityBlock(req, res) {
  try {
    const { date, startAt, endAt, reason, isFullDay = false } = req.body;

    let blockStartAt;
    let blockEndAt;
    let blockIsFullDay = Boolean(isFullDay);

    if (date) {
      const [year, month, day] = String(date).split('-').map((value) => Number.parseInt(value, 10));
      if (!year || !month || !day) {
        return errorResponse(res, 'Date must be in YYYY-MM-DD format.', 400, 'INVALID_DATE');
      }
      blockStartAt = createUtcDateFromIst(year, month, day, 0, 0);
      blockEndAt = createUtcDateFromIst(year, month, day + 1, 0, 0);
      blockIsFullDay = true;
    } else {
      blockStartAt = new Date(startAt);
      blockEndAt = new Date(endAt);
    }

    if (!blockStartAt || !blockEndAt || Number.isNaN(blockStartAt.getTime()) || Number.isNaN(blockEndAt.getTime())) {
      return errorResponse(res, 'Valid startAt and endAt are required.', 400, 'INVALID_RANGE');
    }

    if (blockEndAt <= blockStartAt) {
      return errorResponse(res, 'endAt must be after startAt.', 400, 'INVALID_RANGE');
    }

    const block = await prisma.consultationAvailabilityBlock.create({
      data: {
        startsAt: blockStartAt,
        endsAt: blockEndAt,
        isFullDay: blockIsFullDay,
        reason: reason || null,
        createdBy: req.user.id,
      },
    });

    return successResponse(res, block, 'Availability blocked.', 201);
  } catch (err) {
    logger.error('[AdminConsultation] createAvailabilityBlock error', { error: err.message });
    throw err;
  }
}

async function deleteAvailabilityBlock(req, res) {
  try {
    const block = await prisma.consultationAvailabilityBlock.findUnique({
      where: { id: req.params.id },
    });

    if (!block) {
      return errorResponse(res, 'Availability block not found.', 404, 'NOT_FOUND');
    }

    await prisma.consultationAvailabilityBlock.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    return successResponse(res, null, 'Availability block removed.');
  } catch (err) {
    logger.error('[AdminConsultation] deleteAvailabilityBlock error', { error: err.message });
    throw err;
  }
}

async function updateBooking(req, res) {
  try {
    const booking = await loadBookingWithContacts(req.params.id);

    if (!booking) {
      return errorResponse(res, 'Consultation booking not found.', 404, 'NOT_FOUND');
    }

    const {
      status,
      meetingNotes,
      scheduledStartAt,
      counsellorName,
      counsellorContact,
      counsellorExpertise,
      action,
    } = req.body;

    const updateData = {};

    if (typeof meetingNotes === 'string') {
      updateData.meetingNotes = meetingNotes.trim() || null;
    }

    if (typeof counsellorName === 'string' && counsellorName.trim()) {
      updateData.counsellorName = counsellorName.trim();
    }
    if (typeof counsellorContact === 'string' && counsellorContact.trim()) {
      updateData.counsellorContact = counsellorContact.trim();
    }
    if (typeof counsellorExpertise === 'string' && counsellorExpertise.trim()) {
      updateData.counsellorExpertise = counsellorExpertise.trim();
    }

    let selectedSlot;
    let selectedStartAt = null;
    let selectedEndAt = null;
    let shouldSendScheduleEmail = false;
    const requestedStatus = status || null;

    if (action) {
      const validActions = new Set(['send_24h_reminder', 'send_2h_reminder', 'send_follow_up', 'send_report_email']);
      if (!validActions.has(action)) {
        return errorResponse(res, 'Invalid consultation action.', 400, 'INVALID_ACTION');
      }
    }

    if (scheduledStartAt) {
      selectedSlot = await assertSlotAvailability(scheduledStartAt, { excludeBookingId: booking.id, ignoreCutoff: true });
      selectedStartAt = selectedSlot.scheduledStartAt;
      selectedEndAt = selectedSlot.scheduledEndAt;
      updateData.selectedSlot = inferLegacySlotCode(selectedStartAt);
      updateData.slotSelectedAt = booking.slotSelectedAt || new Date();
      updateData.scheduledStartAt = selectedStartAt;
      updateData.scheduledEndAt = selectedEndAt;
      updateData.scheduledTimezone = 'Asia/Kolkata';
      updateData.meetingDate = selectedStartAt;
      updateData.status = 'meeting_scheduled';
      updateData.meetingConfirmedAt = new Date();

      if (!booking.meetingRoomName) {
        updateData.meetingRoomName = buildMeetingRoomName(booking.id, booking.userId);
      }
      updateData.meetingLink = buildMeetingLink(updateData.meetingRoomName || booking.meetingRoomName);
      shouldSendScheduleEmail = true;
    }

    if (status) {
      const validStatuses = new Set(['slot_mail_sent', 'meeting_scheduled', 'meeting_completed', 'counselling_report_ready']);
      if (!validStatuses.has(status)) {
        return errorResponse(res, 'Invalid booking status.', 400, 'INVALID_STATUS');
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      if (!action) {
        return errorResponse(res, 'No booking changes provided.', 400, 'NO_UPDATES');
      }
    }

    const updated = await prisma.consultationBooking.update({
      where: { id: booking.id },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
            studentProfile: {
              select: {
                fullName: true,
                parentDetail: { select: { email: true, parentName: true } },
              },
            },
          },
        },
        lead: {
          select: { reportId: true },
        },
      },
    });

    if (shouldSendScheduleEmail) {
      const studentName = updated.user?.studentProfile?.fullName || updated.user?.email || 'Student';
      const parentEmail = updated.user?.studentProfile?.parentDetail?.email || null;
      const parentName = updated.user?.studentProfile?.parentDetail?.parentName || null;

      if (updated.user?.email) {
        sendSlotConfirmationEmail({
          to: updated.user.email,
          name: studentName,
          scheduledStartAt: selectedStartAt,
          scheduledEndAt: selectedEndAt,
          counsellorName: updated.counsellorName,
          counsellorContact: updated.counsellorContact,
          meetingLink: updated.meetingLink,
          meetingProvider: updated.meetingProvider,
        }).catch((err) =>
          logger.warn('[AdminConsultation] Student schedule email failed', { error: err.message }),
        );
      }

      if (parentEmail) {
        sendSlotConfirmationEmail({
          to: parentEmail,
          name: parentName || `Parent of ${studentName}`,
          scheduledStartAt: selectedStartAt,
          scheduledEndAt: selectedEndAt,
          counsellorName: updated.counsellorName,
          counsellorContact: updated.counsellorContact,
          meetingLink: updated.meetingLink,
          meetingProvider: updated.meetingProvider,
          isParent: true,
          studentName,
        }).catch((err) =>
          logger.warn('[AdminConsultation] Parent schedule email failed', { error: err.message }),
        );
      }

      sendAdminSlotNotification({
        studentName,
        studentEmail: updated.user?.email,
        bookingId: booking.id,
        scheduledStartAt: selectedStartAt,
        scheduledEndAt: selectedEndAt,
        meetingLink: updated.meetingLink,
        meetingProvider: updated.meetingProvider,
      }).catch((err) =>
        logger.warn('[AdminConsultation] Admin schedule email failed', { error: err.message }),
      );
    }

    if ((requestedStatus === 'meeting_completed' || action === 'send_follow_up') && !updated.followUpSentAt) {
      await sendFollowUpForBooking(updated);
    }

    if ((requestedStatus === 'counselling_report_ready' || action === 'send_report_email') && !updated.counsellingReportSentAt) {
      await sendCounsellingReportForBooking(updated);
    }

    if (action === 'send_24h_reminder') {
      await sendReminderForBooking(updated, 'reminder24hSentAt', 'tomorrow');
    }

    if (action === 'send_2h_reminder') {
      await sendReminderForBooking(updated, 'reminder2hSentAt', 'in about 2 hours');
    }

    return successResponse(res, {
      ...updated,
      scheduledLabel: updated.scheduledStartAt ? formatSlotDateTime(updated.scheduledStartAt) : null,
      scheduledTimeRange: updated.scheduledStartAt && updated.scheduledEndAt
        ? formatSlotTimeRange(updated.scheduledStartAt, updated.scheduledEndAt)
        : null,
    }, 'Consultation booking updated.');
  } catch (err) {
    if (err.code === 'SLOT_UNAVAILABLE') {
      return errorResponse(res, err.message, 409, 'SLOT_UNAVAILABLE');
    }
    if (err.code === 'INVALID_SLOT') {
      return errorResponse(res, err.message, 400, 'INVALID_SLOT');
    }

    logger.error('[AdminConsultation] updateBooking error', { error: err.message });
    throw err;
  }
}

module.exports = {
  listConsultations,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  updateBooking,
};
