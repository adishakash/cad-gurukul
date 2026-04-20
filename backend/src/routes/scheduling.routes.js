'use strict';
/**
 * scheduling.routes.js — Phase 10
 * Mount point: /api/v1/scheduling
 */

const express = require('express');
const router  = express.Router();

const { authenticate, authenticateAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/scheduling.controller');
const {
  createSlotsSchema,
  setMeetLinkSchema,
  updateBookingStatusSchema,
  listSlotsQuerySchema,
  listBookingsQuerySchema,
  bookSlotSchema,
} = require('../validators/scheduling.validator');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Customer slot availability + booking (token-based, no JWT)
// ─────────────────────────────────────────────────────────────────────────────

/** List upcoming available slots */
router.get('/available-slots', ctrl.getAvailableSlots);

/** Customer books a specific slot via their booking token */
router.post('/book', validate(bookSlotSchema), ctrl.bookSlot);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — All routes require admin JWT
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticateAdmin);

// ── Slot management ──────────────────────────────────────────────────────────
router.post('/slots',            validate(createSlotsSchema),     ctrl.createSlots);
router.get('/slots',             validate(listSlotsQuerySchema, 'query'), ctrl.listAdminSlots);
router.get('/slots/:id',         ctrl.getSlot);
router.patch('/slots/:id/block', ctrl.blockSlot);
router.patch('/slots/:id/unblock', ctrl.unblockSlot);
router.delete('/slots/:id',      ctrl.deleteSlot);

// ── Booking management ───────────────────────────────────────────────────────
router.get('/bookings',           validate(listBookingsQuerySchema, 'query'), ctrl.listBookings);
router.get('/bookings/:id',       ctrl.getBooking);
router.patch('/bookings/:id/status',    validate(updateBookingStatusSchema), ctrl.updateBookingStatus);
router.patch('/bookings/:id/meet-link', validate(setMeetLinkSchema),         ctrl.setMeetLink);
router.post('/bookings/:id/send-meet',  ctrl.sendMeetEmail);

module.exports = router;
