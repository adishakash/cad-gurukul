'use strict';
/**
 * Analytics Event Service
 * ────────────────────────────────────────────────
 * Lightweight, fire-and-forget event persistence.
 * All events are stored in analytics_events table.
 *
 * Usage:
 *   const analytics = require('./analyticsService')
 *   analytics.track('payment_success', req, { leadId, amountRupees: 499 })
 */

const crypto = require('crypto');
const prisma = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Track an analytics event.
 * Never throws — errors are logged and swallowed.
 *
 * @param {string} event    - canonical event name
 * @param {object} req      - Express request (for IP/UA; pass null from workers)
 * @param {object} meta     - additional metadata { userId, leadId, source, ... }
 */
function track(event, req, meta = {}) {
  const { userId, leadId, sessionId, source, ...rest } = meta;
  const ipAddress = req ? (req.ip || req.headers?.['x-forwarded-for'] || null) : null;
  const userAgent = req ? (req.get?.('User-Agent') || null) : null;

  prisma.analyticsEvent
    .create({
      data: {
        id: crypto.randomUUID(),
        event,
        userId:    userId || null,
        leadId:    leadId || null,
        sessionId: sessionId || null,
        source:    source || null,
        metadata:  Object.keys(rest).length ? rest : null,
        ipAddress,
        userAgent,
      },
    })
    .catch((err) => logger.warn('[Analytics] track failed (non-fatal)', { event, error: err.message }));
}

/**
 * Funnel summary query used by admin analytics endpoint.
 * Returns counts for each funnel stage over the given time range.
 */
async function getFunnelSummary(since = new Date(0)) {
  const events = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    _count: { id: true },
    where: { createdAt: { gte: since } },
    orderBy: { _count: { id: 'desc' } },
  });

  return events.reduce((acc, row) => {
    acc[row.event] = row._count.id;
    return acc;
  }, {});
}

/**
 * Source breakdown — how many events per source.
 */
async function getSourceBreakdown(since = new Date(0)) {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ['source', 'event'],
    _count: { id: true },
    where: { source: { not: null }, createdAt: { gte: since } },
  });
  return rows;
}

module.exports = { track, getFunnelSummary, getSourceBreakdown };
