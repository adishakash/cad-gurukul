'use strict';
const express = require('express');
const Joi = require('joi');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const paymentController = require('../controllers/payment.controller');

const createOrderSchema = Joi.object({ assessmentId: Joi.string().required() });
const verifySchema = Joi.object({
  razorpayOrderId: Joi.string().required(),
  razorpayPaymentId: Joi.string().required(),
  razorpaySignature: Joi.string().required(),
});

router.use(authenticate);

router.post('/create-order', validate(createOrderSchema), paymentController.createOrder);
router.post('/verify', validate(verifySchema), paymentController.verifyPayment);
router.get('/history', paymentController.getPaymentHistory);

module.exports = router;
