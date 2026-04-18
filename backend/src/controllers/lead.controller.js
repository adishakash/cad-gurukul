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
const prisma  = require('../config/database');
const {
  successResponse,
  errorResponse,
} = require('../utils/helpers');
const logger           = require('../utils/logger');
const analytics        = require('../services/analytics/analyticsService');
const { triggerAutomation } = require('../services/automation/automationService');
const { LEAD_STATUS_ORDER, PLAN_TYPE_ORDER } = require('../utils/leadStatusHelper');

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/leads
 * Public endpoint — creates or upserts a lead.
 * Called from: landing page CTAs, register flow, plan selection.
 * Validation handled by route-level middleware (createLeadSchema).
 */
const createOrUpdateLead = async (req, res) => {
  try {
    const { email, ...rest } = req.body;

    // Deduplicate by email first, then by phone — upsert
    let existing = await prisma.lead.findUnique({ where: { email } });

    // If no email match, check phone (handles mid-assessment temp email flow)
    if (!existing && rest.mobileNumber) {
      existing = await prisma.lead.findFirst({
        where: { mobileNumber: rest.mobileNumber },
        orderBy: { createdAt: 'desc' },
      });
    }

    let lead;
    let isNew = false;

    if (existing) {
      // Update attributable fields (don't downgrade plan)
      // Use { id } not { email } — existing may have been found by phone with a different email
      lead = await prisma.lead.update({
        where: { id: existing.id },
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
 * Validation handled by route-level middleware (updateLeadSchema).
 */
const updateMyLead = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({ where: { userId: req.user.id } });
    if (!lead) return errorResponse(res, 'Lead not found', 404, 'NOT_FOUND');

    const data = { ...req.body };

    // ── Guard: status — never regress the funnel ──────────────────────────────
    if (data.status) {
      const currentIdx   = LEAD_STATUS_ORDER.indexOf(lead.status);
      const requestedIdx = LEAD_STATUS_ORDER.indexOf(data.status);
      if (requestedIdx < currentIdx) {
        logger.warn('[Lead] Status downgrade blocked', {
          userId: req.user.id,
          currentStatus: lead.status,
          requestedStatus: data.status,
        });
        delete data.status;
      }
    }

    // ── Guard: planType — never downgrade a paid plan tier ───────────────────
    if (data.planType !== undefined && lead.planType) {
      const currentPlanIdx   = PLAN_TYPE_ORDER.indexOf(lead.planType);
      const requestedPlanIdx = PLAN_TYPE_ORDER.indexOf(data.planType);
      if (currentPlanIdx !== -1 && requestedPlanIdx !== -1 && requestedPlanIdx < currentPlanIdx) {
        logger.warn('[Lead] planType downgrade blocked', {
          userId: req.user.id,
          currentPlanType: lead.planType,
          requestedPlanType: data.planType,
        });
        delete data.planType;
      }
    }

    // Nothing left to update.
    if (Object.keys(data).length === 0) {
      return successResponse(res, lead, 'Lead unchanged');
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data,
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
 * Validation handled by route-level middleware (appendEventSchema).
 */
const appendLeadEvent = async (req, res) => {
  const { event, metadata } = req.body;

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
