'use strict';
/**
 * Settlement Admin Controller
 * Admin control over Thursday settlement: trigger, dry-run, pause, resume, retry, reconcile.
 */

const prisma  = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { runSettlement, runSettlementForRole } = require('../services/payout/payoutScheduler');
const logger  = require('../utils/logger');

// ─── Trigger Settlement ───────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/settlements/trigger
 * Body: { role?: 'CC'|'CCL'|'ALL', dryRun?: boolean }
 */
const triggerSettlement = async (req, res) => {
  try {
    const { role = 'ALL', dryRun = false } = req.body;

    let results;
    if (role === 'ALL') {
      results = await runSettlement({ dryRun });
    } else if (['CC', 'CCL'].includes(role)) {
      results = { [role]: await runSettlementForRole(role, { dryRun }) };
    } else {
      return errorResponse(res, 'role must be CC, CCL, or ALL', 400, 'INVALID_ROLE');
    }

    return successResponse(res, results, dryRun ? 'Dry run complete' : 'Settlement triggered');
  } catch (err) {
    logger.error('[SettlementAdmin] triggerSettlement error', { error: err.message });
    return errorResponse(res, 'Settlement trigger failed', 500);
  }
};

// ─── Pause Settlement ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/settlements/pause
 * Body: { role: 'CC'|'CCL'|'ALL', reason: string }
 */
const pauseSettlement = async (req, res) => {
  try {
    const { role, reason } = req.body;
    if (!['CC', 'CCL', 'ALL'].includes(role)) {
      return errorResponse(res, 'role must be CC, CCL, or ALL', 400, 'INVALID_ROLE');
    }

    await prisma.settlementSchedule.upsert({
      where:  { role },
      update: { isPaused: true, pausedBy: req.admin.id, pausedAt: new Date(), pauseReason: reason },
      create: { role, dayOfWeek: 4, isPaused: true, pausedBy: req.admin.id, pausedAt: new Date(), pauseReason: reason },
    });

    logger.info('[SettlementAdmin] Settlement paused', { role, reason, adminId: req.admin.id });
    return successResponse(res, null, `Settlement for ${role} paused`);
  } catch (err) {
    logger.error('[SettlementAdmin] pauseSettlement error', { error: err.message });
    return errorResponse(res, 'Failed to pause settlement', 500);
  }
};

// ─── Resume Settlement ────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/settlements/resume
 * Body: { role: 'CC'|'CCL'|'ALL' }
 */
const resumeSettlement = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['CC', 'CCL', 'ALL'].includes(role)) {
      return errorResponse(res, 'role must be CC, CCL, or ALL', 400, 'INVALID_ROLE');
    }

    await prisma.settlementSchedule.update({
      where: { role },
      data:  { isPaused: false, pausedBy: null, pausedAt: null, pauseReason: null },
    });

    logger.info('[SettlementAdmin] Settlement resumed', { role, adminId: req.admin.id });
    return successResponse(res, null, `Settlement for ${role} resumed`);
  } catch (err) {
    logger.error('[SettlementAdmin] resumeSettlement error', { error: err.message });
    return errorResponse(res, 'Failed to resume settlement', 500);
  }
};

// ─── Get Schedule Status ──────────────────────────────────────────────────────

const getScheduleStatus = async (req, res) => {
  try {
    const schedules = await prisma.settlementSchedule.findMany();
    return successResponse(res, { schedules });
  } catch (err) {
    logger.error('[SettlementAdmin] getScheduleStatus error', { error: err.message });
    return errorResponse(res, 'Failed to get schedule status', 500);
  }
};

// ─── Retry Single Payout ──────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/settlements/cc-payouts/:id/retry
 * POST /api/v1/admin/settlements/ccl-payouts/:id/retry
 */
const retryPayout = async (req, res) => {
  try {
    const { id }   = req.params;
    const { role } = req.body; // "CC" | "CCL"

    if (!['CC', 'CCL'].includes(role)) {
      return errorResponse(res, 'role must be CC or CCL', 400, 'INVALID_ROLE');
    }

    const model      = role === 'CC' ? 'ccPayout' : 'cclPayout';
    const userIdKey  = role === 'CC' ? 'ccUserId' : 'cclUserId';
    const commModel  = role === 'CC' ? 'ccCommission' : 'cclCommission';

    const payout = await prisma[model].findUnique({ where: { id } });
    if (!payout) return errorResponse(res, 'Payout not found', 404, 'NOT_FOUND');
    if (payout.status !== 'failed') {
      return errorResponse(res, 'Only failed payouts can be retried', 409, 'INVALID_STATE');
    }

    // Check eligibility first
    const { checkPartnerEligibility } = require('../services/payout/payoutEligibilityChecker');
    const { eligible, reason } = await checkPartnerEligibility(payout[userIdKey]);
    if (!eligible) return errorResponse(res, `Partner ineligible: ${reason}`, 409, 'INELIGIBLE');

    // Reset to processing and re-lock commissions
    await prisma.$transaction(async (tx) => {
      await tx[model].update({
        where: { id },
        data:  { status: 'processing', transferInitiatedAt: new Date() },
      });
      await tx[commModel].updateMany({
        where: { payoutId: id },
        data:  { status: 'in_payout' },
      });
    });

    // Execute
    const bankAccount = await prisma.bankAccount.findUnique({ where: { userId: payout[userIdKey] } });
    const { decrypt } = require('../utils/encryption');
    const decrypted   = { ...bankAccount, accountNumberEnc: decrypt(bankAccount.accountNumberEnc) };
    const { executePayout } = require('../services/payout/payoutExecutionService');
    const { success, transferRef, error } = await executePayout(payout, decrypted, role);

    if (success) {
      await prisma.$transaction(async (tx) => {
        await tx[model].update({ where: { id }, data: { status: 'paid', processedAt: new Date(), transferRef, failureCount: payout.failureCount } });
        await tx[commModel].updateMany({ where: { payoutId: id }, data: { status: 'paid' } });
      });
      return successResponse(res, { transferRef }, 'Payout retried and paid');
    }

    await prisma[model].update({ where: { id }, data: { status: 'failed', notes: error } });
    await prisma[commModel].updateMany({ where: { payoutId: id }, data: { status: 'pending', payoutId: null } });
    return errorResponse(res, `Retry failed: ${error}`, 500, 'TRANSFER_FAILED');

  } catch (err) {
    logger.error('[SettlementAdmin] retryPayout error', { error: err.message });
    return errorResponse(res, 'Retry failed', 500);
  }
};

// ─── Clear Fraud Flag ─────────────────────────────────────────────────────────

const clearFraudFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body; // 'cleared' | 'confirmed_fraud'

    if (!['cleared', 'confirmed_fraud'].includes(resolution)) {
      return errorResponse(res, "resolution must be 'cleared' or 'confirmed_fraud'", 400);
    }

    await prisma.payoutFraudFlag.update({
      where: { id },
      data:  { status: resolution, resolvedBy: req.admin.id, resolvedAt: new Date() },
    });

    return successResponse(res, null, `Fraud flag ${resolution}`);
  } catch (err) {
    logger.error('[SettlementAdmin] clearFraudFlag error', { error: err.message });
    return errorResponse(res, 'Failed to clear fraud flag', 500);
  }
};

// ─── Payout CSV Export ────────────────────────────────────────────────────────

const exportPayoutsCSV = async (req, res) => {
  try {
    const { role = 'CC', status } = req.query;
    if (!['CC', 'CCL'].includes(role)) return errorResponse(res, 'role must be CC or CCL', 400);

    const model     = role === 'CC' ? 'ccPayout' : 'cclPayout';
    const userIdKey = role === 'CC' ? 'ccUserId' : 'cclUserId';
    const where     = status ? { status } : {};

    const payouts = await prisma[model].findMany({
      where,
      orderBy: { scheduledFor: 'desc' },
      include: {
        [role === 'CC' ? 'ccUser' : 'cclUser']: { select: { email: true, name: true } },
      },
    });

    const header = 'id,partnerId,email,name,amountRupees,status,scheduledFor,processedAt,transferRef\n';
    const rows = payouts.map((p) => {
      const user = p[role === 'CC' ? 'ccUser' : 'cclUser'];
      return [
        p.id,
        p[userIdKey],
        user.email,
        (user.name || '').replace(/,/g, ' '),
        (p.amountPaise / 100).toFixed(2),
        p.status,
        p.scheduledFor?.toISOString().slice(0, 10) || '',
        p.processedAt?.toISOString().slice(0, 10)  || '',
        p.transferRef || '',
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${role}-payouts-${Date.now()}.csv"`);
    return res.send(header + rows);
  } catch (err) {
    logger.error('[SettlementAdmin] exportPayoutsCSV error', { error: err.message });
    return errorResponse(res, 'Export failed', 500);
  }
};

module.exports = {
  triggerSettlement,
  pauseSettlement,
  resumeSettlement,
  getScheduleStatus,
  retryPayout,
  clearFraudFlag,
  exportPayoutsCSV,
};
