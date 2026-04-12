'use strict';
const Joi = require('joi');

const createLeadSchema = Joi.object({
  fullName:      Joi.string().trim().min(2).max(100).required(),
  email:         Joi.string().email().lowercase().trim().required(),
  mobileNumber:  Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
    'string.pattern.base': 'Enter a valid 10-digit Indian mobile number',
  }),
  classStandard: Joi.string().valid('8','9','10','11','12').optional(),
  stream:        Joi.string().valid('Science','Commerce','Arts','Not Decided','NA').optional(),
  city:          Joi.string().trim().max(100).optional(),
  pincode:       Joi.string().pattern(/^\d{6}$/).optional(),
  userType:      Joi.string().valid('student','parent').default('student'),
  selectedPlan:  Joi.string().valid('free','paid').default('free'),
  leadSource:    Joi.string().valid(
    'meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other'
  ).default('direct'),
  utmSource:    Joi.string().trim().max(100).optional().allow('', null),
  utmMedium:    Joi.string().trim().max(100).optional().allow('', null),
  utmCampaign:  Joi.string().trim().max(100).optional().allow('', null),
  utmContent:   Joi.string().trim().max(100).optional().allow('', null),
  referralCode: Joi.string().trim().max(50).optional().allow('', null),
});

const updateLeadSchema = Joi.object({
  classStandard:         Joi.string().valid('8','9','10','11','12').optional(),
  stream:                Joi.string().valid('Science','Commerce','Arts','Not Decided','NA').optional(),
  city:                  Joi.string().trim().max(100).optional(),
  pincode:               Joi.string().pattern(/^\d{6}$/).optional(),
  selectedPlan:          Joi.string().valid('free','paid').optional(),
  counsellingInterested: Joi.boolean().optional(),
  counsellingNotes:      Joi.string().trim().max(500).optional().allow('', null),
  status:                Joi.string().valid(
    'new_lead','onboarding_started','plan_selected','assessment_started',
    'assessment_in_progress','assessment_completed','free_report_ready',
    'payment_pending','paid','premium_report_generating',
    'premium_report_ready','counselling_interested','closed'
  ).optional(),
}).min(1).messages({ 'object.min': 'At least one field is required' });

const appendEventSchema = Joi.object({
  event:    Joi.string().trim().max(100).required(),
  metadata: Joi.object().optional(),
});

module.exports = { createLeadSchema, updateLeadSchema, appendEventSchema };
