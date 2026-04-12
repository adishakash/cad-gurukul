'use strict';
/**
 * WhatsApp Service — provider-agnostic abstraction
 * ─────────────────────────────────────────────────
 * Today: persists message records + stubs the send.
 * Tomorrow: swap in WATI / Interakt / Twilio by changing
 *           the _sendViaProvider() implementation only.
 *
 * Environment variables (optional — skips send if absent):
 *   WHATSAPP_PROVIDER  = wati | interakt | twilio | stub
 *   WHATSAPP_API_URL   = https://live-mt-server.wati.io
 *   WHATSAPP_API_TOKEN = <bearer token>
 */

const crypto  = require('crypto');
const prisma  = require('../../config/database');
const logger  = require('../../utils/logger');

const PROVIDER     = process.env.WHATSAPP_PROVIDER || 'stub';
const API_URL      = process.env.WHATSAPP_API_URL;
const API_TOKEN    = process.env.WHATSAPP_API_TOKEN;
const IS_ENABLED   = PROVIDER !== 'stub' && !!API_URL && !!API_TOKEN;

/**
 * sendTemplateMessage
 * @param {object} opts
 * @param {string} opts.toNumber       - E.164 Indian number, e.g. "919876543210"
 * @param {string} opts.templateName   - WhatsApp approved template name
 * @param {object} opts.variables      - key/value pairs mapped to template params
 * @param {string} [opts.leadId]
 * @param {string} [opts.userId]
 * @returns {Promise<{messageId: string}>}
 */
async function sendTemplateMessage({ toNumber, templateName, variables = {}, leadId, userId }) {
  // Sanitize number to E.164 (add 91 prefix if bare 10-digit Indian number)
  const normalized = _normalizeNumber(toNumber);
  if (!normalized) {
    logger.warn('[WhatsApp] Invalid number — skipped', { toNumber, templateName });
    return { messageId: null };
  }

  // Persist log record (status: queued)
  const msgId = crypto.randomUUID();
  let dbRecord;
  try {
    dbRecord = await prisma.whatsAppMessage.create({
      data: {
        id:           msgId,
        leadId:       leadId || null,
        userId:       userId || null,
        toNumber:     normalized,
        templateName,
        payload:      variables,
        status:       'queued',
      },
    });
  } catch (err) {
    logger.error('[WhatsApp] DB persist failed', { error: err.message });
    // Don't throw — message logging failure must not halt caller
    return { messageId: null };
  }

  if (!IS_ENABLED) {
    logger.info('[WhatsApp] STUB mode — message not sent', { to: normalized, template: templateName });
    await _updateStatus(dbRecord.id, 'skipped');
    return { messageId: dbRecord.id };
  }

  // Send via configured provider
  try {
    const providerRef = await _sendViaProvider(normalized, templateName, variables);
    await _updateStatus(dbRecord.id, 'sent', { providerRef, sentAt: new Date() });
    logger.info('[WhatsApp] Sent', { to: normalized, template: templateName, providerRef });
    return { messageId: dbRecord.id };
  } catch (err) {
    logger.error('[WhatsApp] Send failed', { to: normalized, template: templateName, error: err.message });
    await _updateStatus(dbRecord.id, 'failed', { errorMessage: err.message });
    throw err; // re-throw so automationService can catch & log
  }
}

// ── Provider-specific implementation ─────────────────────────────────────────

async function _sendViaProvider(toNumber, templateName, variables) {
  if (PROVIDER === 'wati') {
    return _sendWati(toNumber, templateName, variables);
  }
  if (PROVIDER === 'interakt') {
    return _sendInterakt(toNumber, templateName, variables);
  }
  throw new Error(`Unknown WhatsApp provider: ${PROVIDER}`);
}

/** WATI implementation — https://docs.wati.io */
async function _sendWati(toNumber, templateName, variables) {
  const { default: fetch } = await import('node-fetch');
  const parameters = Object.entries(variables).map(([, value]) => ({ name: 'text', value: String(value) }));

  const res = await fetch(`${API_URL}/api/v1/sendTemplateMessage?whatsappNumber=${toNumber}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_name: templateName, broadcast_name: templateName, parameters }),
  });
  if (!res.ok) throw new Error(`WATI HTTP ${res.status}`);
  const json = await res.json();
  return json.id || json.messageId || 'wati_ok';
}

/** Interakt implementation — https://developers.interakt.ai */
async function _sendInterakt(toNumber, templateName, variables) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: { Authorization: `Basic ${API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryCode: '+91',
      phoneNumber: toNumber.replace(/^91/, ''),
      callbackData: 'cg_automation',
      type: 'Template',
      template: {
        name: templateName,
        languageCode: 'en',
        bodyValues: Object.values(variables).map(String),
      },
    }),
  });
  if (!res.ok) throw new Error(`Interakt HTTP ${res.status}`);
  const json = await res.json();
  return json.id || 'interakt_ok';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _normalizeNumber(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

async function _updateStatus(id, status, extra = {}) {
  try {
    await prisma.whatsAppMessage.update({ where: { id }, data: { status, ...extra } });
  } catch (err) {
    logger.warn('[WhatsApp] status update failed', { id, status, error: err.message });
  }
}

module.exports = { sendTemplateMessage };
