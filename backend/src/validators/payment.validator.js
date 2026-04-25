'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
  planType: Joi.string().valid('standard', 'premium', 'consultation').default('standard'),
  assessmentId: Joi.when('planType', {
    is: 'consultation',
    then: Joi.string().trim().optional(),
    otherwise: Joi.string().trim().required(),
  }),
  referralCode: Joi.string().trim().max(50).optional().allow('', null),
  couponCode:   Joi.string().trim().max(20).optional().allow('', null),
});

const verifyPaymentSchema = Joi.object({
  razorpayOrderId:   Joi.string().trim().required(),
  razorpayPaymentId: Joi.string().trim().required(),
  razorpaySignature: Joi.string().trim().required(),
});

module.exports = { createOrderSchema, verifyPaymentSchema };
