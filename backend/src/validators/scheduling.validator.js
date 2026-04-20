'use strict';
const Joi = require('joi');

// ─────────────────────────────────────────────────────────────────────────────
// Admin: create slots
// ─────────────────────────────────────────────────────────────────────────────

const slotSchema = Joi.object({
  date:      Joi.string().isoDate().required(),         // "2026-06-25"
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // "09:00"
  endTime:   Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // "12:00"
  label:     Joi.string().min(3).max(100).required(),
  notes:     Joi.string().max(500).optional().allow(''),
});

const createSlotsSchema = Joi.object({
  slots: Joi.array().items(slotSchema).min(1).max(50).required(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: update meeting link
// ─────────────────────────────────────────────────────────────────────────────

const setMeetLinkSchema = Joi.object({
  meetLink: Joi.string().uri().required(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: update booking status
// ─────────────────────────────────────────────────────────────────────────────

const updateBookingStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      'slot_mail_sent',
      'slot_selected',
      'meeting_scheduled',
      'meeting_completed',
      'counselling_report_ready',
    )
    .required(),
  meetingNotes: Joi.string().max(1000).optional().allow(''),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: list slots query
// ─────────────────────────────────────────────────────────────────────────────

const listSlotsQuerySchema = Joi.object({
  from:   Joi.string().isoDate().optional(),
  to:     Joi.string().isoDate().optional(),
  status: Joi.string()
    .valid('all', 'available', 'booked', 'blocked')
    .default('all'),
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(60),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: list bookings query
// ─────────────────────────────────────────────────────────────────────────────

const listBookingsQuerySchema = Joi.object({
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(100).default(30),
  status: Joi.string()
    .valid(
      'slot_mail_sent',
      'slot_selected',
      'meeting_scheduled',
      'meeting_completed',
      'counselling_report_ready',
    )
    .optional(),
  search: Joi.string().max(100).optional().allow(''),
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer: book a specific slot
// ─────────────────────────────────────────────────────────────────────────────

const bookSlotSchema = Joi.object({
  token:  Joi.string().min(32).required(),
  slotId: Joi.string().required(),
});

module.exports = {
  createSlotsSchema,
  setMeetLinkSchema,
  updateBookingStatusSchema,
  listSlotsQuerySchema,
  listBookingsQuerySchema,
  bookSlotSchema,
};
