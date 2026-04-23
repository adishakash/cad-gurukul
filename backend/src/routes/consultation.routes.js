'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate, requirePortalRole } = require('../middleware/auth');
const consultationController = require('../controllers/consultation.controller');

// ── Public: token-based slot selection (no JWT required) ─────────────────
router.get('/availability', consultationController.getAvailability);
router.post('/select-slot', consultationController.selectSlot);

// ── Auth-protected: fetch current user's consultation booking ──────────────
router.get('/my', authenticate, consultationController.getMyBooking);

// ── Auth-protected: resend slot-selection email (30-min cooldown) ────────────
router.post('/resend', authenticate, consultationController.resendSlotEmail);

// ── Auth-protected: recover booking for legacy users who paid but never got email
router.post('/recover', authenticate, consultationController.recoverConsultationBooking);

// ── Admin-only: send a test slot-selection email to verify SMTP ────────────
// POST /consultation/test-email  {  to?: string  }  (defaults to admin's own email)
router.post('/test-email', authenticate, requirePortalRole('ADMIN'), consultationController.testSlotEmail);

module.exports = router;
