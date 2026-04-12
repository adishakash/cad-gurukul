'use strict';
const Joi = require('joi');

const leadListQuerySchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  limit:    Joi.number().integer().min(1).max(100).default(20),
  status:   Joi.string().valid(
    'new_lead','onboarding_started','plan_selected','assessment_started',
    'assessment_in_progress','assessment_completed','free_report_ready',
    'payment_pending','paid','premium_report_generating',
    'premium_report_ready','counselling_interested','closed'
  ).optional(),
  leadSource: Joi.string().valid(
    'meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other'
  ).optional(),
  classStandard: Joi.string().valid('8', '9', '10', '11', '12').optional(),
  selectedPlan: Joi.string().valid('free', 'paid').optional(),
  search:   Joi.string().trim().max(200).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo:   Joi.date().iso().optional(),
  source:   Joi.string().valid(
    'meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other'
  ).optional(),
  plan:     Joi.string().valid('free', 'paid').optional(),
  from:     Joi.date().iso().optional(),
  to:       Joi.date().iso().optional(),
  sortBy:   Joi.string().valid('createdAt','updatedAt').default('createdAt'),
  sortDir:  Joi.string().valid('asc','desc').default('desc'),
});

const adminActionSchema = Joi.object({
  notes: Joi.string().trim().max(500).optional().allow('', null),
});

const triggerActionSchema = Joi.object({
  action: Joi.string()
    .valid('regenerate_report', 'resend_report_link', 'mark_counselling')
    .required(),
  interested: Joi.boolean().optional(),
  notes:      Joi.string().trim().max(500).optional().allow('', null),
});

const markCounsellingSchema = Joi.object({
  interested: Joi.boolean().required(),
  notes:      Joi.string().trim().max(500).optional().allow('', null),
});

const retriggerSchema = Joi.object({
  eventName: Joi.string().trim().max(100).required(),
});

module.exports = {
  leadListQuerySchema,
  adminActionSchema,
  markCounsellingSchema,
  retriggerSchema,
  triggerActionSchema,
};
