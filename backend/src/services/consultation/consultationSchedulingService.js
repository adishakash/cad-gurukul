'use strict';

const crypto = require('crypto');
const prisma = require('../../config/database');

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const SLOT_DURATION_MINUTES = 60;
const AVAILABILITY_WINDOW_DAYS = 21;

const DEFAULT_SLOT_TEMPLATES = [
  { key: 'morning_10', label: '10:00 AM', hour: 10, minute: 0 },
  { key: 'midday_12', label: '12:00 PM', hour: 12, minute: 0 },
  { key: 'afternoon_3', label: '3:00 PM', hour: 15, minute: 0 },
  { key: 'evening_5', label: '5:00 PM', hour: 17, minute: 0 },
  { key: 'evening_7', label: '7:00 PM', hour: 19, minute: 0 },
];

function getIstDate(date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function getIstParts(date) {
  const istDate = getIstDate(date);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    day: istDate.getUTCDate(),
    hour: istDate.getUTCHours(),
    minute: istDate.getUTCMinutes(),
  };
}

function createUtcDateFromIst(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS);
}

function startOfIstDay(date) {
  const { year, month, day } = getIstParts(date);
  return createUtcDateFromIst(year, month, day, 0, 0);
}

function endOfIstDay(date) {
  const start = startOfIstDay(date);
  return new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);
}

function formatIstDate(date) {
  const { year, month, day } = getIstParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatSlotDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatSlotTimeRange(startAt, endAt) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return `${formatter.format(startAt)} - ${formatter.format(endAt)} IST`;
}

function inferLegacySlotCode(startAt) {
  const { hour } = getIstParts(startAt);
  if (hour < 12) return 'morning_9_12';
  if (hour < 17) return 'afternoon_2_5';
  return 'evening_6_9';
}

function buildMeetingRoomName(bookingId, userId) {
  const fingerprint = crypto
    .createHash('sha1')
    .update(`${bookingId}:${userId}`)
    .digest('hex')
    .slice(0, 10);

  return `cadgurukul-career-session-${fingerprint}`;
}

function buildMeetingLink(roomName) {
  return `https://meet.jit.si/${roomName}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function buildSlot(startAt, template) {
  const endAt = new Date(startAt.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
  return {
    key: `${formatIstDate(startAt)}-${template.key}`,
    templateKey: template.key,
    startAt,
    endAt,
    startsAtIso: startAt.toISOString(),
    endsAtIso: endAt.toISOString(),
    label: `${formatSlotDateTime(startAt)} (${formatSlotTimeRange(startAt, endAt)})`,
    legacySlotCode: inferLegacySlotCode(startAt),
  };
}

async function getAvailabilityContext({ from = new Date(), days = AVAILABILITY_WINDOW_DAYS, excludeBookingId = null } = {}) {
  const startAt = startOfIstDay(from);
  const endAt = endOfIstDay(new Date(startAt.getTime() + (Math.max(days, 1) - 1) * 24 * 60 * 60 * 1000));

  const [blocks, bookings] = await Promise.all([
    prisma.consultationAvailabilityBlock.findMany({
      where: {
        isActive: true,
        startsAt: { lte: endAt },
        endsAt: { gte: startAt },
      },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.consultationBooking.findMany({
      where: {
        scheduledStartAt: { not: null, gte: startAt, lte: endAt },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: {
        id: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        user: {
          select: {
            email: true,
            studentProfile: { select: { fullName: true } },
          },
        },
      },
      orderBy: { scheduledStartAt: 'asc' },
    }),
  ]);

  return { startAt, endAt, blocks, bookings };
}

function isBlockedSlot(slot, blocks) {
  return blocks.some((block) => rangesOverlap(slot.startAt, slot.endAt, new Date(block.startsAt), new Date(block.endsAt)));
}

function findBookingConflict(slot, bookings) {
  return bookings.find((booking) =>
    booking.scheduledStartAt &&
    booking.scheduledEndAt &&
    rangesOverlap(slot.startAt, slot.endAt, new Date(booking.scheduledStartAt), new Date(booking.scheduledEndAt))
  );
}

async function listAvailableSlots({ from = new Date(), days = AVAILABILITY_WINDOW_DAYS, excludeBookingId = null, ignoreCutoff = false } = {}) {
  const { startAt, blocks, bookings } = await getAvailabilityContext({ from, days, excludeBookingId });
  const results = [];
  const now = Date.now();
  const minBookableTs = now + (12 * 60 * 60 * 1000);

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dayStart = new Date(startAt.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayLabel = new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(dayStart);

    const slots = DEFAULT_SLOT_TEMPLATES.map((template) => {
      const { year, month, day } = getIstParts(dayStart);
      const startAtForSlot = createUtcDateFromIst(year, month, day, template.hour, template.minute);
      return buildSlot(startAtForSlot, template);
    }).map((slot) => {
      const block = isBlockedSlot(slot, blocks);
      const conflict = findBookingConflict(slot, bookings);
      const isPastCutoff = !ignoreCutoff && slot.startAt.getTime() < minBookableTs;

      return {
        ...slot,
        isAvailable: !block && !conflict && !isPastCutoff,
        isBlocked: block,
        isBooked: Boolean(conflict),
        unavailableReason: isPastCutoff ? 'Cutoff passed' : conflict ? 'Already booked' : block ? 'Blocked by admin' : null,
        bookedBy: conflict ? (conflict.user?.studentProfile?.fullName || conflict.user?.email || 'Booked') : null,
      };
    });

    results.push({
      date: formatIstDate(dayStart),
      label: dayLabel,
      isFullyBlocked: slots.every((slot) => !slot.isAvailable),
      slots,
    });
  }

  return results;
}

async function assertSlotAvailability(slotStartAt, { excludeBookingId = null, ignoreCutoff = false } = {}) {
  const slotStart = new Date(slotStartAt);
  if (Number.isNaN(slotStart.getTime())) {
    const error = new Error('Invalid slot start time');
    error.code = 'INVALID_SLOT';
    throw error;
  }

  const { year, month, day, hour, minute } = getIstParts(slotStart);
  const slot = buildSlot(createUtcDateFromIst(year, month, day, hour, minute), {
    key: `${hour}:${minute}`,
    label: formatSlotTimeRange(slotStart, new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000)),
    hour,
    minute,
  });

  const from = startOfIstDay(slot.startAt);
  const availability = await listAvailableSlots({ from, days: 1, excludeBookingId, ignoreCutoff });
  const match = availability[0]?.slots?.find((candidate) => candidate.startsAtIso === slot.startAt.toISOString());

  if (!match) {
    const error = new Error('Selected slot is outside the supported consultation schedule.');
    error.code = 'INVALID_SLOT';
    throw error;
  }

  if (!match.isAvailable) {
    const error = new Error(match.unavailableReason || 'Selected slot is no longer available.');
    error.code = 'SLOT_UNAVAILABLE';
    throw error;
  }

  return {
    ...match,
    scheduledStartAt: match.startAt,
    scheduledEndAt: match.endAt,
  };
}

async function listConsultationCalendar({ from = new Date(), days = 14 } = {}) {
  const [availability, bookings, blocks] = await Promise.all([
    listAvailableSlots({ from, days }),
    prisma.consultationBooking.findMany({
      where: {
        OR: [
          { status: { in: ['booking_confirmed', 'slot_mail_sent', 'slot_selected'] } },
          {
            scheduledStartAt: {
              gte: startOfIstDay(from),
              lte: endOfIstDay(new Date(startOfIstDay(from).getTime() + (Math.max(days, 1) - 1) * 24 * 60 * 60 * 1000)),
            },
          },
        ],
      },
      orderBy: [
        { scheduledStartAt: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            email: true,
            studentProfile: {
              select: {
                fullName: true,
                mobileNumber: true,
                parentDetail: { select: { email: true, parentName: true } },
              },
            },
          },
        },
        counsellorUser: {
          select: { id: true, name: true, email: true },
        },
        lead: {
          select: { reportId: true },
        },
      },
    }),
    prisma.consultationAvailabilityBlock.findMany({
      where: {
        isActive: true,
        startsAt: { lte: endOfIstDay(new Date(startOfIstDay(from).getTime() + (Math.max(days, 1) - 1) * 24 * 60 * 60 * 1000)) },
        endsAt: { gte: startOfIstDay(from) },
      },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  return {
    availability,
    bookings: bookings.map((booking) => ({
      ...booking,
      studentName: booking.user?.studentProfile?.fullName || booking.user?.email || 'Student',
      studentEmail: booking.user?.email || null,
      studentPhone: booking.user?.studentProfile?.mobileNumber || null,
      parentEmail: booking.user?.studentProfile?.parentDetail?.email || null,
      parentName: booking.user?.studentProfile?.parentDetail?.parentName || null,
      scheduledLabel: booking.scheduledStartAt ? formatSlotDateTime(new Date(booking.scheduledStartAt)) : null,
    })),
    blocks: blocks.map((block) => ({
      ...block,
      dateLabel: formatSlotDateTime(new Date(block.startsAt)),
    })),
    defaults: {
      timezone: 'Asia/Kolkata',
      slotDurationMinutes: SLOT_DURATION_MINUTES,
      slotTemplates: DEFAULT_SLOT_TEMPLATES,
    },
  };
}

module.exports = {
  AVAILABILITY_WINDOW_DAYS,
  SLOT_DURATION_MINUTES,
  DEFAULT_SLOT_TEMPLATES,
  listAvailableSlots,
  assertSlotAvailability,
  listConsultationCalendar,
  buildMeetingRoomName,
  buildMeetingLink,
  formatSlotDateTime,
  formatSlotTimeRange,
  formatIstDate,
  createUtcDateFromIst,
  startOfIstDay,
  endOfIstDay,
  inferLegacySlotCode,
};
