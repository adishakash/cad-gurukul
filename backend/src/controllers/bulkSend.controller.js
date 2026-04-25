'use strict';
/**
 * Bulk Send Controller
 * CCL: bulk joining-link send to multiple recipients (max 50)
 */

const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

let automationService;
try { automationService = require('../services/automation/automationService'); } catch (_) {}

const MAX_RECIPIENTS = 50;

// ─── CCL: Bulk Joining Links ───────────────────────────────────────────────────

/**
 * POST /api/v1/staff/joining-links/bulk
 * Body: { recipients: [{ name, phone, email? }], message? }
 */
const bulkSendJoiningLinks = async (req, res) => {
  try {
    const { recipients, message } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return errorResponse(res, 'recipients must be a non-empty array', 400, 'INVALID_INPUT');
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return errorResponse(res, `Max ${MAX_RECIPIENTS} recipients per request`, 400, 'TOO_MANY_RECIPIENTS');
    }

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        if (!r.phone || !r.name) throw new Error(`Invalid recipient: missing name or phone`);

        const link = await prisma.cclJoiningLink.create({
          data: {
            cclId:       req.user.id,
            candidateName:  r.name,
            candidatePhone: r.phone,
            candidateEmail: r.email || null,
          },
        });

        if (automationService?.triggerAutomation) {
          try {
            await automationService.triggerAutomation('ccl_joining_link_send', {
              phone:       r.phone,
              name:        r.name,
              joiningToken: link.token,
              message,
            });
          } catch (waErr) {
            logger.warn('[BulkSend] WA send failed for recipient', { phone: r.phone, error: waErr.message });
          }
        }

        return { phone: r.phone, name: r.name, token: link.token, status: 'sent' };
      })
    );

    const sent   = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => ({ error: r.reason?.message }));

    logger.info('[BulkSend] CCL bulk joining link send', { userId: req.user.id, sent: sent.length, failed: failed.length });
    return successResponse(res, { sent, failed, total: recipients.length }, `Sent ${sent.length}/${recipients.length} links`);
  } catch (err) {
    logger.error('[BulkSend] bulkSendJoiningLinks error', { error: err.message });
    return errorResponse(res, 'Failed to send bulk joining links', 500);
  }
};

module.exports = { bulkSendJoiningLinks };
