'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
  assessmentId: Joi.string().trim().required(),
});

const verifyPaymentSchema = Joi.object({
  razorpayOrderId:   Joi.string().trim().required(),
  razorpayPaymentId: Joi.string().trim().required(),
  razorpaySignature: Joi.string().trim().required(),
});

module.exports = { createOrderSchema, verifyPaymentSchema };
