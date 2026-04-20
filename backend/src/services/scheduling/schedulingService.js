'use strict';
/**
 * schedulingService.js — Phase 10
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for admin-managed AvailabilitySlot CRUD and the atomic
 * double-booking-safe customer slot-booking flow.
 *
 * Double-booking prevention strategy:
 *   All booking mutations run inside a Prisma interactive transaction.
 *   The critical "claim" step uses updateMany with a WHERE clause that includes
 *   isBooked: false, isBlocked: false.  Prisma/PostgreSQL evaluates this as a
 *   single atomic UPDATE … WHERE …, which is safe under concurrent load because
 *   PostgreSQL row-level locking prevents two transactions from advancing
 *   simultaneously on the same row.  If count === 0 the slot is already gone.
 */

const prisma  = require('../../config/database');
const logger  = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a Date object as "Wednesday, 25 June 2026"
 * @param {Date} d
 */
function formatDateIST(d) {
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format start/end time strings as "9:00 AM – 12:00 PM IST"
 * @param {string} start - "09:00"
 * @param {string} end   - "12:00"
 */
function formatTimeRange(start, end) {
  const fmt = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm   = h >= 12 ? 'PM' : 'AM';
    const h12    = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)} IST`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot CRUD (admin-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create one or many availability slots.
 *
 * @param {Array<{date: Date, startTime: string, endTime: string, label: string, notes?: string}>} slots
 * @returns {Promise<object[]>} created slot rows
 */
async function createSlots(slots) {
  const created = await prisma.$transaction(
    slots.map((s) =>
      prisma.availabilitySlot.upsert({
        where: { date_startTime: { date: s.date, startTime: s.startTime } },
        create: {
          date:      s.date,
          startTime: s.startTime,
          endTime:   s.endTime,
          label:     s.label,
          notes:     s.notes || null,
        },
        update: {
          endTime:   s.endTime,
          label:     s.label,
          notes:     s.notes ?? undefined,
          // Never overwrite isBooked — that must only change through the booking flow
          isBlocked: false, // re-opening a blocked slot
        },
      }),
    ),
  );
  logger.info('[Scheduling] Slots created/upserted', { count: created.length });
  return created;
}

/**
 * Block a slot (admin closes it without a booking).
 */
async function blockSlot(slotId) {
  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot)          throw Object.assign(new Error('Slot not found'), { code: 'NOT_FOUND' });
  if (slot.isBooked)  throw Object.assign(new Error('Slot is already booked'), { code: 'ALREADY_BOOKED' });

  return prisma.availabilitySlot.update({
    where: { id: slotId },
    data:  { isBlocked: true },
  });
}

/**
 * Unblock / re-open a slot.
 */
async function unblockSlot(slotId) {
  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot) throw Object.assign(new Error('Slot not found'), { code: 'NOT_FOUND' });

  return prisma.availabilitySlot.update({
    where: { id: slotId },
    data:  { isBlocked: false },
  });
}

/**
 * Delete a free (unbooked, unblocked) slot.
 */
async function deleteSlot(slotId) {
  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!slot)         throw Object.assign(new Error('Slot not found'), { code: 'NOT_FOUND' });
  if (slot.isBooked) throw Object.assign(new Error('Cannot delete a booked slot'), { code: 'SLOT_BOOKED' });

  return prisma.availabilitySlot.delete({ where: { id: slotId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// List queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all available (not booked, not blocked) slots from today onwards.
 * Used by the customer slot-selection page.
 *
 * @param {object} [opts]
 * @param {Date}   [opts.from]  - start date filter (default: today)
 * @param {Date}   [opts.to]    - end date filter
 * @param {number} [opts.limit] - max results (default: 60)
 */
async function getAvailableSlots({ from, to, limit = 60 } = {}) {
  const fromDate = from || new Date();
  // Normalize to start of today (UTC midnight) so slots today still appear
  fromDate.setUTCHours(0, 0, 0, 0);

  const where = {
    isBooked:  false,
    isBlocked: false,
    date:      { gte: fromDate },
  };
  if (to) where.date.lte = to;

  const slots = await prisma.availabilitySlot.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: limit,
    select: {
      id:        true,
      date:      true,
      startTime: true,
      endTime:   true,
      label:     true,
    },
  });

  return slots.map((s) => ({
    ...s,
    dateStr: formatDateIST(s.date),
    timeStr: formatTimeRange(s.startTime, s.endTime),
  }));
}

/**
 * Get all slots for admin view (any date range, any status).
 */
async function getAdminSlots({ from, to, status } = {}) {
  const where = {};

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to)   where.date.lte = to;
  }

  if (status === 'available') {
    where.isBooked  = false;
    where.isBlocked = false;
  } else if (status === 'booked') {
    where.isBooked = true;
  } else if (status === 'blocked') {
    where.isBlocked = true;
  }

  const slots = await prisma.availabilitySlot.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      booking: {
        select: {
          id:             true,
          status:         true,
          counsellorName: true,
          googleMeetLink: true,
          user: {
            select: {
              email: true,
              studentProfile: {
                select: { fullName: true, mobileNumber: true },
              },
            },
          },
        },
      },
    },
  });

  return slots.map((s) => ({
    ...s,
    dateStr: formatDateIST(s.date),
    timeStr: formatTimeRange(s.startTime, s.endTime),
  }));
}

/**
 * Get a single slot by ID with full booking details.
 */
async function getSlotById(slotId) {
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: {
      booking: {
        include: {
          user: {
            select: {
              email: true,
              studentProfile: {
                select: { fullName: true, mobileNumber: true },
              },
            },
          },
        },
      },
    },
  });
  if (!slot) return null;
  return {
    ...slot,
    dateStr: formatDateIST(slot.date),
    timeStr: formatTimeRange(slot.startTime, slot.endTime),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic slot booking (customer flow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically claim an AvailabilitySlot for a ConsultationBooking.
 *
 * Uses updateMany with isBooked: false / isBlocked: false in the WHERE clause.
 * If the count returned is 0, the slot was taken concurrently → SLOT_UNAVAILABLE.
 *
 * @param {string} slotId
 * @param {string} bookingId
 * @returns {Promise<{slot: object, scheduledDateStr: string, scheduledTimeStr: string}>}
 * @throws {{code: 'NOT_FOUND' | 'SLOT_UNAVAILABLE'}} on failure
 */
async function claimSlot(slotId, bookingId) {
  let result;

  try {
    result = await prisma.$transaction(async (tx) => {
      // ── Step 1: Atomic claim — the WHERE condition prevents double-booking ──
      const claimed = await tx.availabilitySlot.updateMany({
        where: { id: slotId, isBooked: false, isBlocked: false },
        data:  { isBooked: true, bookingId },
      });

      if (claimed.count === 0) {
        // Either doesn't exist, is booked, or is blocked
        const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });
        if (!slot) throw Object.assign(new Error('Slot not found'), { code: 'NOT_FOUND' });
        throw Object.assign(
          new Error('Slot is no longer available'),
          { code: 'SLOT_UNAVAILABLE' },
        );
      }

      // ── Step 2: Fetch the slot details (now locked to us) ──────────────────
      const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });

      // ── Step 3: Update the ConsultationBooking with denormalised date/time ─
      await tx.consultationBooking.update({
        where: { id: bookingId },
        data: {
          scheduledDate:      slot.date,
          scheduledStartTime: slot.startTime,
          scheduledEndTime:   slot.endTime,
          selectedSlot:       slot.label,
          slotSelectedAt:     new Date(),
          status:             'slot_selected',
        },
      });

      return slot;
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'SLOT_UNAVAILABLE') throw err;
    logger.error('[Scheduling] claimSlot transaction error', { slotId, bookingId, error: err.message });
    throw err;
  }

  logger.info('[Scheduling] Slot claimed', { slotId, bookingId });

  return {
    slot:             result,
    scheduledDateStr: formatDateIST(result.date),
    scheduledTimeStr: formatTimeRange(result.startTime, result.endTime),
  };
}

/**
 * Save the Google Meet link against the booking after successful Meet creation.
 */
async function saveMeetLink(bookingId, { meetLink, eventId }) {
  return prisma.consultationBooking.update({
    where: { id: bookingId },
    data: {
      googleMeetLink: meetLink,
      googleEventId:  eventId || null,
      meetLinkSentAt: new Date(),
      status:         'meeting_scheduled',
      meetingLink:    meetLink, // keep legacy field in sync
    },
  });
}

/**
 * Admin: manually update meeting link for a booking.
 */
async function adminSetMeetLink(bookingId, meetLink) {
  return prisma.consultationBooking.update({
    where: { id: bookingId },
    data: {
      googleMeetLink: meetLink,
      meetingLink:    meetLink,
      status:         'meeting_scheduled',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin bookings view
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated list of all consultation bookings for the admin scheduling dashboard.
 */
async function listBookings({ page = 1, limit = 30, status, search } = {}) {
  const skip  = (page - 1) * limit;
  const where = {};

  if (status) where.status = status;

  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { studentProfile: { fullName: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  const [total, bookings] = await Promise.all([
    prisma.consultationBooking.count({ where }),
    prisma.consultationBooking.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            studentProfile: {
              select: { fullName: true, mobileNumber: true },
            },
          },
        },
        availabilitySlot: {
          select: { id: true, date: true, startTime: true, endTime: true, label: true },
        },
      },
    }),
  ]);

  return {
    total,
    page,
    pages: Math.ceil(total / limit),
    data:  bookings,
  };
}

module.exports = {
  // Admin slot management
  createSlots,
  blockSlot,
  unblockSlot,
  deleteSlot,
  getAdminSlots,
  getSlotById,
  adminSetMeetLink,
  // Customer flow
  getAvailableSlots,
  claimSlot,
  saveMeetLink,
  // Bookings view
  listBookings,
  // Helpers (exported for email building)
  formatDateIST,
  formatTimeRange,
};
