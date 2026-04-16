'use strict';
/**
 * Public Joining Link Routes
 * ─────────────────────────────────────────────────────────────────
 * Unauthenticated — candidate-facing payment flow for CCL joining links.
 *
 * GET  /api/v1/join/:code              — resolve link (fees, CCL info, discount)
 * POST /api/v1/join/:code/create-order — create Razorpay order for joining fee
 * POST /api/v1/join/:code/verify       — verify payment, create sale + commission
 */

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const { validate } = require('../middleware/validate');
const cclController = require('../controllers/ccl.controller');

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

// GET /api/v1/join/:code
router.get('/:code', cclController.resolveJoiningLink);

// POST /api/v1/join/:code/create-order
router.post('/:code/create-order', validate(createOrderSchema), cclController.createJoiningOrder);

// POST /api/v1/join/:code/verify
router.post('/:code/verify', validate(verifySchema), cclController.verifyJoiningPayment);

module.exports = router;
