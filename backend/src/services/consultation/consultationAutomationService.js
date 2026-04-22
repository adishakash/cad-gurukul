'use strict';

const prisma = require('../../config/database');
const logger = require('../../utils/logger');
const {
  sendConsultationReminderEmail,
  sendConsultationFollowUpEmail,
  sendCounsellingReportEmail,
} = require('../email/emailService');

async function loadBookingContacts(booking) {
  const studentName = booking.user?.studentProfile?.fullName || booking.user?.email || 'Student';
  return {
    studentName,
    studentEmail: booking.user?.email || null,
    parentEmail: booking.user?.studentProfile?.parentDetail?.email || null,
    parentName: booking.user?.studentProfile?.parentDetail?.parentName || null,
  };
}

async function sendReminderForBooking(booking, reminderField, reminderLabel) {
  const { studentName, studentEmail, parentEmail, parentName } = await loadBookingContacts(booking);

  if (studentEmail) {
    await sendConsultationReminderEmail({
      to: studentEmail,
      name: studentName,
      scheduledStartAt: booking.scheduledStartAt,
      scheduledEndAt: booking.scheduledEndAt,
      meetingLink: booking.meetingLink,
      counsellorName: booking.counsellorName,
      counsellorContact: booking.counsellorContact,
      reminderLabel,
    });
  }

  if (parentEmail) {
    await sendConsultationReminderEmail({
      to: parentEmail,
      name: parentName || `Parent of ${studentName}`,
      scheduledStartAt: booking.scheduledStartAt,
      scheduledEndAt: booking.scheduledEndAt,
      meetingLink: booking.meetingLink,
      counsellorName: booking.counsellorName,
      counsellorContact: booking.counsellorContact,
      reminderLabel,
      isParent: true,
      studentName,
    });
  }

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { [reminderField]: new Date() },
  });
}

async function sendFollowUpForBooking(booking) {
  const { studentName, studentEmail, parentEmail, parentName } = await loadBookingContacts(booking);

  if (studentEmail) {
    await sendConsultationFollowUpEmail({
      to: studentEmail,
      name: studentName,
      counsellorName: booking.counsellorName,
      meetingLink: booking.meetingLink,
    });
  }

  if (parentEmail) {
    await sendConsultationFollowUpEmail({
      to: parentEmail,
      name: parentName || `Parent of ${studentName}`,
      counsellorName: booking.counsellorName,
      meetingLink: booking.meetingLink,
      isParent: true,
      studentName,
    });
  }

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { followUpSentAt: new Date() },
  });
}

async function sendCounsellingReportForBooking(booking) {
  const { studentName, studentEmail, parentEmail, parentName } = await loadBookingContacts(booking);

  if (studentEmail) {
    await sendCounsellingReportEmail({
      to: studentEmail,
      name: studentName,
      reportId: booking.lead?.reportId || null,
      counsellorName: booking.counsellorName,
    });
  }

  if (parentEmail) {
    await sendCounsellingReportEmail({
      to: parentEmail,
      name: parentName || `Parent of ${studentName}`,
      reportId: booking.lead?.reportId || null,
      counsellorName: booking.counsellorName,
      isParent: true,
      studentName,
    });
  }

  await prisma.consultationBooking.update({
    where: { id: booking.id },
    data: { counsellingReportSentAt: new Date() },
  });
}

async function runConsultationAutomationPass() {
  const now = Date.now();

  const bookings = await prisma.consultationBooking.findMany({
    where: {
      OR: [
        { status: 'meeting_scheduled', reminder24hSentAt: null },
        { status: 'meeting_scheduled', reminder2hSentAt: null },
        { status: 'meeting_completed', followUpSentAt: null },
        { status: 'counselling_report_ready', counsellingReportSentAt: null },
      ],
    },
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
    orderBy: { scheduledStartAt: 'asc' },
  });

  for (const booking of bookings) {
    try {
      if (booking.status === 'meeting_scheduled' && booking.scheduledStartAt && booking.scheduledEndAt && booking.meetingLink) {
        const startTime = new Date(booking.scheduledStartAt).getTime();
        const msUntilStart = startTime - now;

        if (!booking.reminder24hSentAt && msUntilStart <= 24 * 60 * 60 * 1000 && msUntilStart > 2 * 60 * 60 * 1000) {
          await sendReminderForBooking(booking, 'reminder24hSentAt', 'tomorrow');
          logger.info('[ConsultationAutomation] 24h reminder sent', { bookingId: booking.id });
          continue;
        }

        if (!booking.reminder2hSentAt && msUntilStart <= 2 * 60 * 60 * 1000 && msUntilStart > 0) {
          await sendReminderForBooking(booking, 'reminder2hSentAt', 'in about 2 hours');
          logger.info('[ConsultationAutomation] 2h reminder sent', { bookingId: booking.id });
          continue;
        }
      }

      if (booking.status === 'meeting_completed' && !booking.followUpSentAt) {
        await sendFollowUpForBooking(booking);
        logger.info('[ConsultationAutomation] follow-up sent', { bookingId: booking.id });
        continue;
      }

      if (booking.status === 'counselling_report_ready' && !booking.counsellingReportSentAt) {
        await sendCounsellingReportForBooking(booking);
        logger.info('[ConsultationAutomation] counselling report sent', { bookingId: booking.id });
      }
    } catch (err) {
      logger.warn('[ConsultationAutomation] pass item failed', {
        bookingId: booking.id,
        error: err.message,
      });
    }
  }
}

function startConsultationAutomation(intervalMs) {
  const timer = setInterval(() => {
    runConsultationAutomationPass().catch((err) => {
      logger.warn('[ConsultationAutomation] scheduled pass failed', { error: err.message });
    });
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();

  runConsultationAutomationPass().catch((err) => {
    logger.warn('[ConsultationAutomation] initial pass failed', { error: err.message });
  });

  return timer;
}

module.exports = {
  runConsultationAutomationPass,
  startConsultationAutomation,
  sendReminderForBooking,
  sendFollowUpForBooking,
  sendCounsellingReportForBooking,
};
