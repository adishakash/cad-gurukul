'use strict';
const Joi = require('joi');

const PLAN_499_PAISE = 49900;

const createTestLinkSchema = Joi.object({
  planType:       Joi.string().valid('499plan', 'standard').default('standard'),
  candidateName:  Joi.string().max(120),
  candidateEmail: Joi.string().email(),
  candidatePhone: Joi.string().pattern(/^[6-9]\d{9}$/),
  expiryDays:     Joi.number().integer().min(1).max(90),
  feeAmountPaise: Joi.number().integer().min(1),
});

const updateDiscountSchema = Joi.object({
  discountPct: Joi.number().min(0).max(100).required(),  // 100 is max possible; backend enforces per-plan cap
  planType:    Joi.string().valid('499plan', 'standard').required(),
  isActive:    Joi.boolean(),
});

module.exports = { createTestLinkSchema, updateDiscountSchema, PLAN_499_PAISE };
