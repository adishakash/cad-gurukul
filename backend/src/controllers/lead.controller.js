'use strict';
/**
 * Lead Controller
 * ───────────────────────────────────────────────────────────
 * Manages the full lead lifecycle:
 *   POST /leads          — create or upsert lead (deduplicates by email)
 *   GET  /leads/me       — fetch current user's lead
 *   PATCH /leads/me      — update lead fields / status
 *   POST /leads/me/events — append a custom timeline event
 *
 * Upsert logic: if email already exists we UPDATE (not error) so that
 * the same user can update their plan/source preferences.
 */

const crypto  = require('crypto');
const Joi     = require('joi');
const prisma  = require('../config/database');
const {
  successResponse,
  errorResponse,
} = require('../utils/helpers');
const logger           = require('../utils/logger');
const analytics        = require('../services/analytics/analyticsService');
const { triggerAutomation } = require('../services/automation/automationService');

// ── Validation schemas ────────────────────────────────────────────────────────

const createLeadSchema = Joi.object({
  fullName:      Joi.string().trim().min(2).max(100).required(),
  email:         Joi.string().email().lowercase().trim().required(),
  mobileNumber:  Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
    'string.pattern.base': 'Enter a valid 10-digit Indian mobile number',
  }),
  classStandard: Joi.string().valid('8','9','10','11','12').optional(),
  stream:        Joi.string().valid('Science','Commerce','Arts','NA').optional(),
  city:          Joi.string().trim().max(100).optional(),
  pincode:       Joi.string().pattern(/^\d{6}$/).optional(),
  userType:      Joi.string().valid('student','parent').default('student'),
  selectedPlan:  Joi.string().valid('free','paid').default('free'),
  leadSource:    Joi.string().valid(
    'meta_ads','instagram','facebook','google_ads','direct','referral','organic','whatsapp','other'
  ).default('direct'),
  utmSource:    Joi.string().trim().max(100).optional(),
  utmMedium:    Joi.string().trim().max(100).optional(),
  utmCampaign:  Joi.string().trim().max(100).optional(),
  utmContent:   Joi.string().trim().max(100).optional(),
  referralCode: Joi.string().trim().max(50).optional(),
});

const updateLeadSchema = Joi.object({
  classStandard:        Joi.string().valid('8','9','10','11','12').optional(),
  stream:               Joi.string().valid('Science','Commerce','Arts','Not Decided','NA').optional(),
  city:                 Joi.string().trim().max(100).optional(),
  pincode:              Joi.string().pattern(/^\d{6}$/).optional(),
  selectedPlan:         Joi.string().valid('free','paid').optional(),
  counsellingInterested: Joi.boolean().optional(),
  counsellingNotes:     Joi.string().trim().max(500).optional(),
  status:               Joi.string().valid(
    'new_lead','assessment_started','assessment_completed',
    'free_report_ready','payment_pending','paid',
    'premium_report_ready','counselling_interested','closed'
  ).optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/leads
 * Public endpoint — creates or upserts a lead.
 * Called from: landing page CTAs, register flow, plan selection.
 */
const createOrUpdateLead = async (req, res) => {
  const { error, value } = createLeadSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return errorResponse(res, 'Validation failed', 422, 'VALIDATION_ERROR',
      error.details.map((d) => d.message));
  }

  try {
    const { email, ...rest } = value;

    // Deduplicate by email — upsert
    const existing = await prisma.lead.findUnique({ where: { email } });

    let lead;
    let isNew = false;

    if (existing) {
      // Update attributable fields (don't downgrade plan)
      lead = await prisma.lead.update({
        where: { email },
        data: {
          fullName:      rest.fullName      || existing.fullName,
          mobileNumber:  rest.mobileNumber  || existing.mobileNumber,
          classStandard: rest.classStandard || existing.classStandard,
          stream:        rest.stream        || existing.stream,
          city:          rest.city          || existing.city,
          pincode:       rest.pincode       || existing.pincode,
          userType:      rest.userType      || existing.userType,
          selectedPlan:  rest.selectedPlan === 'paid' ? 'paid' : existing.selectedPlan,
          // Attribution — only set if missing
          leadSource:  existing.leadSource !== 'direct' ? existing.leadSource : (rest.leadSource || existing.leadSource),
          utmSource:   existing.utmSource   || rest.utmSource   || null,
          utmMedium:   existing.utmMedium   || rest.utmMedium   || null,
          utmCampaign: existing.utmCampaign || rest.utmCampaign || null,
          utmContent:  existing.utmContent  || rest.utmContent  || null,
          // Link to user if now authenticated
          userId: req.user?.id || existing.userId || null,
        },
      });
    } else {
      lead = await prisma.lead.create({
        data: {
          id:    crypto.randomUUID(),
          email,
          ...rest,
          userId: req.user?.id || null,
        },
      });
      isNew = true;
    }

    if (isNew) {
      analytics.track('lead_created', req, {
        leadId: lead.id,
        userId: req.user?.id,
        source: lead.leadSource,
      });
      await triggerAutomation('lead_created', {
        leadId:      lead.id,
        fullName:    lead.fullName,
        mobileNumber: lead.mobileNumber,
        selectedPlan: lead.selectedPlan,
      });
    }

    logger.info('[Lead] upserted', { leadId: lead.id, isNew });
    return successResponse(res, { leadId: lead.id, isNew }, isNew ? 'Lead created' : 'Lead updated', isNew ? 201 : 200);
  } catch (err) {
    logger.error('[Lead] createOrUpdateLead error', { error: err.message });
    throw err;
  }
};

/**
 * GET /api/v1/leads/me
 * Authenticated — returns lead linked to current userId.
 */
const getMyLead = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { userId: req.user.id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lead) return successResponse(res, null, 'No lead found');
    return successResponse(res, lead);
  } catch (err) {
    logger.error('[Lead] getMyLead error', { error: err.message });
    throw err;
  }
};

/**
 * PATCH /api/v1/leads/me
 * Authenticated — update partial lead fields.
 */
const updateMyLead = async (req, res) => {
  const { error, value } = updateLeadSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return errorResponse(res, 'Validation failed', 422, 'VALIDATION_ERROR',
      error.details.map((d) => d.message));
  }

  try {
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { ...value },
    });

    return successResponse(res, updated, 'Lead updated');
  } catch (err) {
    logger.error('[Lead] updateMyLead error', { error: err.message });
    throw err;
  }
};

/**
 * POST /api/v1/leads/me/events
 * Append a custom event to the lead timeline (e.g. "premium_cta_clicked").
 * Accepts { event: string, metadata?: object }
 */
const appendLeadEvent = async (req, res) => {
  const { event, metadata } = req.body;
  if (!event || typeof event !== 'string') {
    return errorResponse(res, 'event is required', 422, 'VALIDATION_ERROR');
  }

  try {
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    const leadEvent = await prisma.leadEvent.create({
      data: {
        id:       crypto.randomUUID(),
        leadId:   lead.id,
        event,
        metadata: metadata || null,
      },
    });

    analytics.track(event, req, { leadId: lead.id, userId: req.user.id, ...metadata });

    return successResponse(res, { id: leadEvent.id }, 'Event recorded', 201);
  } catch (err) {
    logger.error('[Lead] appendLeadEvent error', { error: err.message });
    throw err;
  }
};

/**
 * POST /api/v1/leads/me/link-user
 * Called after registration — links the user account to their lead record.
 */
const linkUserToLead = async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return errorResponse(res, 'leadId required', 422, 'VALIDATION_ERROR');

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    // Prevent hijacking another user's lead
    if (lead.userId && lead.userId !== req.user.id) {
      return errorResponse(res, 'Lead already linked to a different account', 409, 'CONFLICT');
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { userId: req.user.id },
    });

    return successResponse(res, { linked: true });
  } catch (err) {
    logger.error('[Lead] linkUserToLead error', { error: err.message });
    throw err;
  }
};

module.exports = {
  createOrUpdateLead,
  getMyLead,
  updateMyLead,
  appendLeadEvent,
  linkUserToLead,
};
