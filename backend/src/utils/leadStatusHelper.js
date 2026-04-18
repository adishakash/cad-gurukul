'use strict';
/**
 * leadStatusHelper.js
 * ─────────────────────────────────────────────────────────────
 * Utility for safely advancing lead funnel status and planType.
 *
 * Core rule: purchased/paid state is the authoritative source of truth.
 * Neither profile edits, nor a re-run assessment, nor any frontend
 * action can regress a lead that has already passed a milestone.
 *
 * Use these helpers everywhere a direct prisma.lead.update() wants to
 * write a status or planType, to ensure forward-only progression.
 */

const prisma  = require('../config/database');
const logger  = require('./logger');

// Ordered funnel stages (forward-only).
// The position in this array is the authority — higher index = later stage.
const LEAD_STATUS_ORDER = [
  'new_lead',
  'onboarding_started',
  'plan_selected',
  'assessment_started',
  'assessment_in_progress',
  'assessment_completed',
  'free_report_ready',
  'payment_pending',
  'paid',
  'premium_report_generating',
  'premium_report_ready',
  'counselling_interested',
  'closed',
];

// Plan tiers — higher index = higher-value plan.
const PLAN_TYPE_ORDER = ['standard', 'premium', 'consultation'];

/**
 * Safely update a lead's status and/or planType so they can only move forward.
 *
 * @param {string} leadId        The lead's primary key.
 * @param {object} updates       Object containing any of: { status, planType, ...other }
 *                               Any non-status/planType fields are written unconditionally.
 * @returns {Promise<object>}    The updated lead record, or the unchanged record if nothing changed.
 */
async function safeLeadUpdate(leadId, updates) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    logger.warn('[leadStatusHelper] safeLeadUpdate: lead not found', { leadId });
    return null;
  }

  const data = { ...updates };

  // ── Guard: status ──────────────────────────────────────────────────────────
  if (data.status !== undefined) {
    const currentIdx  = LEAD_STATUS_ORDER.indexOf(lead.status);
    const requestedIdx = LEAD_STATUS_ORDER.indexOf(data.status);

    if (requestedIdx < currentIdx) {
      logger.warn('[leadStatusHelper] Status downgrade blocked', {
        leadId,
        currentStatus:   lead.status,
        requestedStatus: data.status,
      });
      delete data.status;
    }
  }

  // ── Guard: planType ────────────────────────────────────────────────────────
  if (data.planType !== undefined && lead.planType) {
    const currentPlanIdx  = PLAN_TYPE_ORDER.indexOf(lead.planType);
    const requestedPlanIdx = PLAN_TYPE_ORDER.indexOf(data.planType);

    // Only block if: current planType is known AND requested is a lower tier.
    if (currentPlanIdx !== -1 && requestedPlanIdx !== -1 && requestedPlanIdx < currentPlanIdx) {
      logger.warn('[leadStatusHelper] planType downgrade blocked', {
        leadId,
        currentPlanType:   lead.planType,
        requestedPlanType: data.planType,
      });
      delete data.planType;
    }
  }

  if (Object.keys(data).length === 0) {
    return lead; // nothing to change
  }

  return prisma.lead.update({ where: { id: leadId }, data });
}

/**
 * Convenience wrapper: find the lead for a userId and safely update it.
 *
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function safeLeadUpdateForUser(userId, updates) {
  const lead = await prisma.lead.findFirst({ where: { userId } });
  if (!lead) return null;
  return safeLeadUpdate(lead.id, updates);
}

/**
 * Convenience wrapper: find the lead by reportId and safely update it.
 * Used in generateReportAsync where the lead is found via the report.
 *
 * @param {string} reportId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
async function safeLeadUpdateByReportId(reportId, updates) {
  const lead = await prisma.lead.findFirst({ where: { reportId } });
  if (!lead) return null;
  return safeLeadUpdate(lead.id, updates);
}

module.exports = {
  LEAD_STATUS_ORDER,
  PLAN_TYPE_ORDER,
  safeLeadUpdate,
  safeLeadUpdateForUser,
  safeLeadUpdateByReportId,
};
