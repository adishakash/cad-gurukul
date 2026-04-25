'use strict';
const Joi = require('joi');

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

module.exports = { couponCreateSchema, couponUpdateSchema };
