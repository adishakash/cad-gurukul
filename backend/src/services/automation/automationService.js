'use strict';
/**
 * Automation Service
 * ─────────────────────────────────────────────────────
 * Clean abstraction for event-driven automation hooks.
 * Persists every event as an AutomationJob in the DB so
 * nothing is lost if a downstream provider is unavailable.
 *
 * Usage:
 *   const { triggerAutomation } = require('./automationService')
 *   await triggerAutomation('payment_success', { leadId, userId, amountRupees: 499 })
 *
 * Event names (canonical list):
 *   lead_created | assessment_started | assessment_abandoned
 *   assessment_completed | free_report_ready | payment_initiated
 *   payment_success | payment_failed | premium_report_ready
 *   counselling_cta_clicked
 */

const prisma  = require('../../config/database');
const logger  = require('../../utils/logger');
const { randomUUID } = require('crypto');
const whatsappService = require('../whatsapp/whatsappService');

// ── Template map: event → WhatsApp template name ─────────────────────────────
const WA_TEMPLATE_MAP = {
  lead_created:           'cg_welcome',
  assessment_completed:   'cg_assessment_done',
  free_report_ready:      'cg_free_report_ready',
  free_report_viewed:     'cg_upgrade_nudge',        // Re-engagement: seen report but not paid
  payment_initiated:      'cg_payment_reminder',     // Abandoned payment reminder
  payment_success:        'cg_payment_success',      // Standard ₹499 purchase
  premium_ai_purchased:   'cg_premium_ai_upsell',    // ₹1,999 → upsell ₹9,999 session
  consultation_booked:    'cg_consultation_confirm', // ₹9,999 session confirmed
  premium_report_ready:   'cg_premium_report_ready',
  assessment_abandoned:   'cg_resume_assessment',
};

// ── Internal: enrich lead data for WhatsApp payload ──────────────────────────
async function _buildWaPayload(eventName, payload) {
  const { leadId, userId } = payload;

  let toNumber = payload.mobileNumber;
  let firstName = payload.fullName?.split(' ')[0] || 'there';

  if (!toNumber && (leadId || userId)) {
    const lead = leadId
      ? await prisma.lead.findUnique({ where: { id: leadId }, select: { mobileNumber: true, fullName: true } })
      : null;
    if (lead) {
      toNumber  = lead.mobileNumber;
      firstName = lead.fullName?.split(' ')[0] || firstName;
    }
  }

  if (!toNumber) return null;

  return {
    toNumber,
    templateName: WA_TEMPLATE_MAP[eventName],
    variables: { firstName, ...payload },
  };
}

/**
 * Core trigger — persists the job then fires side-effects.
 * Never throws — errors are logged and captured in the job record.
 */
async function triggerAutomation(eventName, payload = {}) {
  // Persist job
  let job;
  try {
    job = await prisma.automationJob.create({
      data: {
        id:        randomUUID(),
        eventName,
        payload,
        status:    'pending',
        attempts:  0,
        maxAttempts: 3,
      },
    });
  } catch (err) {
    logger.error('[Automation] failed to persist job', { eventName, error: err.message });
    return; // fail silently — do not crash caller
  }

  // Fire handlers
  try {
    await _handleEvent(eventName, payload, job.id);
    await prisma.automationJob.update({
      where: { id: job.id },
      data: { status: 'done', processedAt: new Date(), attempts: 1 },
    });
  } catch (err) {
    logger.error('[Automation] handler error', { eventName, jobId: job.id, error: err.message });
    await prisma.automationJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: err.message, attempts: 1 },
    }).catch(() => {});
  }
}

/**
 * Internal dispatch — add more handlers here as providers are integrated.
 */
async function _handleEvent(eventName, payload, jobId) {
  logger.info('[Automation] handling event', { eventName, jobId });

  // 1. Update lead status
  await _updateLeadStatus(eventName, payload);

  // 2. Append lead event timeline
  await _appendLeadEvent(eventName, payload);

  // 3. WhatsApp message (non-blocking stub — real send skipped if not configured)
  const templateName = WA_TEMPLATE_MAP[eventName];
  if (templateName) {
    const waPayload = await _buildWaPayload(eventName, payload);
    if (waPayload) {
      await whatsappService.sendTemplateMessage(waPayload).catch((err) => {
        logger.warn('[Automation] WhatsApp send failed (non-fatal)', { eventName, error: err.message });
      });
    }
  }
}

// ── Lead status mapping ───────────────────────────────────────────────────────
const EVENT_TO_LEAD_STATUS = {
  assessment_started:      'assessment_started',
  assessment_completed:    'assessment_completed',
  free_report_ready:       'free_report_ready',
  free_report_viewed:      'free_report_ready',      // Keeps status, triggers WhatsApp nudge
  payment_initiated:       'payment_pending',
  payment_success:         'paid',
  premium_ai_purchased:    'paid',                   // Also paid; differentiated by planType
  consultation_booked:     'counselling_interested',
  premium_report_ready:    'premium_report_ready',
  counselling_cta_clicked: 'counselling_interested',
};

async function _updateLeadStatus(eventName, payload) {
  const { leadId } = payload;
  const newStatus = EVENT_TO_LEAD_STATUS[eventName];
  if (!leadId || !newStatus) return;

  try {
    const currentLead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });

    // Avoid downgrading premium generation state back to paid during payment_success automation.
    if (eventName === 'payment_success' && currentLead?.status === 'premium_report_generating') {
      return;
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus, updatedAt: new Date() },
    });
  } catch (err) {
    logger.warn('[Automation] lead status update failed', { leadId, newStatus, error: err.message });
  }
}

async function _appendLeadEvent(eventName, payload) {
  const { leadId, ...rest } = payload;
  if (!leadId) return;

  try {
    await prisma.leadEvent.create({
      data: {
        id:       randomUUID(),
        leadId,
        event:    eventName,
        metadata: rest,
      },
    });
  } catch (err) {
    logger.warn('[Automation] lead event append failed', { leadId, error: err.message });
  }
}

module.exports = { triggerAutomation };
