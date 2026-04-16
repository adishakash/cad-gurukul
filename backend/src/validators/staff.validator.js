'use strict';
const Joi = require('joi');

/**
 * Staff (Career Counsellor Lead / Career Counsellor) login schema.
 * Identical structure to adminLoginSchema — kept separate so each can evolve
 * independently (e.g., future MFA fields for specific roles).
 */
const staffLoginSchema = Joi.object({
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

/**
 * Staff lead list query — same filter surface as admin, but read-only.
 * No bulk-action or mutation fields exposed here.
 */
const staffLeadListQuerySchema = Joi.object({
  page:          Joi.number().integer().min(1).default(1),
  limit:         Joi.number().integer().min(1).max(100).default(25),
  status:        Joi.string().valid(
    'new_lead','onboarding_started','plan_selected','assessment_started',
    'assessment_in_progress','assessment_completed','free_report_ready',
    'payment_pending','paid','premium_report_generating',
    'premium_report_ready','counselling_interested','closed'
  ).optional(),
  leadSource:    Joi.string().valid(
    'meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other'
  ).optional(),
  classStandard: Joi.string().valid('8','9','10','11','12').optional(),
  selectedPlan:  Joi.string().valid('free','paid').optional(),
  search:        Joi.string().trim().max(200).optional(),
  dateFrom:      Joi.date().iso().optional(),
  dateTo:        Joi.date().iso().optional(),
  sortBy:        Joi.string().valid('createdAt','updatedAt').default('createdAt'),
  sortDir:       Joi.string().valid('asc','desc').default('desc'),
});

module.exports = { staffLoginSchema, staffLeadListQuerySchema };
