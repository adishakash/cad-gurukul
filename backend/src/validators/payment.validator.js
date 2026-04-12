'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
  planType: Joi.string().valid('standard', 'premium', 'consultation').default('standard'),
  assessmentId: Joi.when('planType', {
    is: 'consultation',
    then: Joi.string().trim().optional(),
    otherwise: Joi.string().trim().required(),
  }),
});

const verifyPaymentSchema = Joi.object({
  razorpayOrderId:   Joi.string().trim().required(),
  razorpayPaymentId: Joi.string().trim().required(),
  razorpaySignature: Joi.string().trim().required(),
});

module.exports = { createOrderSchema, verifyPaymentSchema };
