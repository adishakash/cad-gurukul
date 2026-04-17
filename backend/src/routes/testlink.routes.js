'use strict';
/**
 * Public Test Link Routes
 * ─────────────────────────────────────────────────────────────────
 * Unauthenticated — candidate-facing payment flow for CC test links.
 *
 * GET  /api/v1/testlink/:code        — resolve link (fees, CC info, discount)
 * POST /api/v1/testlink/:code/order  — create Razorpay order for test fee
 * POST /api/v1/testlink/:code/verify — verify payment, create sale + commission
 */

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { validate } = require('../middleware/validate');
const ccController = require('../controllers/cc.controller');

// Joi schema for creating a payment order
const createOrderSchema = Joi.object({
  candidateName:  Joi.string().max(100).trim().optional(),
  candidateEmail: Joi.string().email().lowercase().trim().optional(),
  candidatePhone: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
});

// Joi schema for verifying a payment
const verifySchema = Joi.object({
  razorpayOrderId:   Joi.string().required(),
  razorpayPaymentId: Joi.string().required(),
  razorpaySignature: Joi.string().required(),
});

const { generalLimiter } = require('../middleware/rateLimiter');

// GET /api/v1/testlink/:code
router.get('/:code', ccController.resolveTestLink);

// POST /api/v1/testlink/:code/order
router.post('/:code/order', generalLimiter, validate(createOrderSchema), ccController.createTestOrder);

// POST /api/v1/testlink/:code/verify
router.post('/:code/verify', generalLimiter, validate(verifySchema), ccController.verifyTestPayment);

module.exports = router;
