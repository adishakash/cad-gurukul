'use strict';
const Joi = require('joi');

/**
 * Body schema for POST /staff/joining-links
 * All candidate fields are optional — a CCL may create a blank link and share
 * it verbally, or fill in the candidate details for attribution purposes.
 */
const createJoiningLinkSchema = Joi.object({
  candidateName:  Joi.string().trim().max(200).optional().allow('', null),
  candidateEmail: Joi.string().email().lowercase().trim().optional().allow('', null),
  candidatePhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow('', null)
    .messages({ 'string.pattern.base': 'Phone must be a valid 10-digit Indian mobile number.' }),
  expiresInDays:  Joi.number().integer().min(1).max(90).optional().allow(null),
});

/**
 * Body schema for PUT /staff/discount
 * discountPct is additionally capped server-side at MAX_DISCOUNT_PCT (20).
 */
const updateDiscountSchema = Joi.object({
  discountPct: Joi.number().min(0).max(20).required()
    .messages({ 'number.max': 'Discount cannot exceed 20%.' }),
  isActive: Joi.boolean().required(),
});

module.exports = { createJoiningLinkSchema, updateDiscountSchema };
