'use strict';
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const paymentController = require('../controllers/payment.controller');
const { createOrderSchema, verifyPaymentSchema } = require('../validators/payment.validator');

// Razorpay server-to-server webhook (no user JWT)
router.post('/webhook', paymentController.handleWebhook);

router.use(authenticate);

router.post('/create-order', validate(createOrderSchema), paymentController.createOrder);
router.post('/verify', validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get('/history', paymentController.getPaymentHistory);
router.get('/status/:orderId', paymentController.getPaymentStatus);

module.exports = router;
