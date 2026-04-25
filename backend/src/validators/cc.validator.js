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
  // Phase 6: inline discount at link creation (validated against DiscountPolicy server-side)
  discountPct:    Joi.number().min(0).max(100).optional().allow(null),
});

const updateDiscountSchema = Joi.object({
  discountPct: Joi.number().min(0).max(100).required(),  // 100 is max possible; backend enforces per-plan cap
  planType:    Joi.string().valid('499plan', 'standard').required(),
  isActive:    Joi.boolean(),
});

const couponCreateSchema = Joi.object({
  code:         Joi.string().trim().uppercase().pattern(/^[A-Z0-9]{4,20}$/).optional().allow('', null),
  planType:     Joi.string().valid('standard', 'premium', 'consultation').required(),
  discountPct:  Joi.number().min(0).max(100).required(),
  isActive:     Joi.boolean().optional(),
  maxRedemptions: Joi.number().integer().min(1).optional().allow(null),
  expiresAt:    Joi.date().iso().optional().allow(null),
});

const couponUpdateSchema = Joi.object({
  discountPct:  Joi.number().min(0).max(100).optional(),
  isActive:     Joi.boolean().optional(),
  maxRedemptions: Joi.number().integer().min(1).optional().allow(null),
  expiresAt:    Joi.date().iso().optional().allow(null),
}).min(1);

module.exports = { createTestLinkSchema, updateDiscountSchema, couponCreateSchema, couponUpdateSchema, PLAN_499_PAISE };
