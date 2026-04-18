'use strict';
const express = require('express');
const router  = express.Router();

const { authenticate } = require('../middleware/auth');
const consultationController = require('../controllers/consultation.controller');

// ── Public: token-based slot selection (no JWT required) ─────────────────────
router.post('/select-slot', consultationController.selectSlot);

// ── Auth-protected: fetch current user's consultation booking ────────────────
router.get('/my', authenticate, consultationController.getMyBooking);

module.exports = router;
