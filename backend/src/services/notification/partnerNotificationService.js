'use strict';
/**
 * Partner Notification Service
 * Sends WhatsApp + email notifications to CC/CCL partners.
 * Never throws — logs errors and returns gracefully.
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

// Optional integrations — may not exist in all deploys
let sendEmail;
try { ({ sendEmail } = require('../email/emailService')); } catch (_) {}

let automationService;
try { automationService = require('../automation/automationService'); } catch (_) {}

// ─── Template Definitions ─────────────────────────────────────────────────────

const TEMPLATES = {
  partner_application_received: {
    emailSubject: 'Your CAD Gurukul Partner Application Was Received',
    emailBody: (p) => `Hi ${p.name},\n\nThank you for applying as a ${p.role} partner.\nOur team will review your application and get back to you within 2 business days.\n\nCAD Gurukul Team`,
    waKey: 'partner_application_received',
  },
  partner_approved: {
    emailSubject: '🎉 Your Partner Application Is Approved!',
    emailBody: (p) => `Hi ${p.name},\n\nCongratulations! Your partner account has been approved.\nYou can now log in and start earning commissions.\n\nCAD Gurukul Team`,
    waKey: 'partner_approved',
  },
  partner_rejected: {
    emailSubject: 'Application Status Update',
    emailBody: (p) => `Hi ${p.name},\n\nWe regret to inform you that your partner application could not be approved at this time.\n${p.reason ? `Reason: ${p.reason}` : ''}\n\nCAD Gurukul Team`,
    waKey: 'partner_rejected',
  },
  commission_credited: {
    emailSubject: 'Commission Credited – CAD Gurukul',
    emailBody: (p) => `Hi ${p.name},\n\nA commission of ₹${p.amount} has been credited to your pending payout for the enrollment of ${p.studentName}.\n\nCAD Gurukul Team`,
    waKey: 'commission_credited',
  },
  payout_initiated: {
    emailSubject: 'Payout Initiated – CAD Gurukul',
    emailBody: (p) => `Hi ${p.name},\n\nYour payout of ₹${p.amount} has been initiated and will be credited within 1–2 business days.\n\nCAD Gurukul Team`,
    waKey: 'payout_initiated',
  },
  payout_paid: {
    emailSubject: '✅ Payout Successful – CAD Gurukul',
    emailBody: (p) => `Hi ${p.name},\n\nYour payout of ₹${p.amount} has been successfully transferred to your bank account (****${p.last4}).\nReference: ${p.transferRef}\n\nCAD Gurukul Team`,
    waKey: 'payout_paid',
  },
  payout_failed: {
    emailSubject: '⚠️ Payout Failed – Action Required',
    emailBody: (p) => `Hi ${p.name},\n\nYour payout of ₹${p.amount} could not be processed.\nPlease update your bank account details and contact support.\n\nCAD Gurukul Team`,
    waKey: 'payout_failed',
  },
  bank_account_verified: {
    emailSubject: 'Bank Account Verified – CAD Gurukul',
    emailBody: (p) => `Hi ${p.name},\n\nYour bank account ending in ****${p.last4} has been verified. You are now eligible for payouts.\n\nCAD Gurukul Team`,
    waKey: 'bank_account_verified',
  },
};

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * @param {string|null} userId  - null for pre-registration notifications (use payload.email directly)
 * @param {string}      key     - template key from TEMPLATES
 * @param {object}      payload - template variables
 */
const notifyPartner = async (userId, key, payload = {}) => {
  const template = TEMPLATES[key];
  if (!template) {
    logger.warn('[PartnerNotify] Unknown template key', { key });
    return;
  }

  let user = null;
  let email = payload.email || null;
  let phone = payload.phone || null;
  let name  = payload.name  || 'Partner';

  try {
    if (userId) {
      user  = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true } });
      email = user?.email || email;
      phone = user?.phone || phone;
      name  = user?.name  || name;
    }

    const templatePayload = { name, ...payload };

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    if (phone && automationService?.triggerAutomation) {
      try {
        await automationService.triggerAutomation(template.waKey, { phone, ...templatePayload });
      } catch (waErr) {
        logger.warn('[PartnerNotify] WA send failed', { key, error: waErr.message });
      }
    }

    // ── Email ─────────────────────────────────────────────────────────────────
    if (email && sendEmail) {
      try {
        await sendEmail({ to: email, subject: template.emailSubject, text: template.emailBody(templatePayload) });
      } catch (mailErr) {
        logger.warn('[PartnerNotify] Email send failed', { key, error: mailErr.message });
      }
    }

    // ── Notification Log ──────────────────────────────────────────────────────
    try {
      await prisma.notificationLog.create({
        data: {
          userId:  userId || null,
          channel: email ? 'EMAIL' : 'WHATSAPP',
          templateKey: key,
          recipientEmail: email,
          recipientPhone: phone,
          status: 'SENT',
          payload: JSON.stringify(templatePayload),
        },
      });
    } catch (logErr) {
      logger.warn('[PartnerNotify] NotificationLog write failed', { error: logErr.message });
    }
  } catch (err) {
    logger.error('[PartnerNotify] Unexpected error', { key, userId, error: err.message });
  }
};

module.exports = { notifyPartner };
