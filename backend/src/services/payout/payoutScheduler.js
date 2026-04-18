'use strict';
/**
 * Payout Scheduler — Thursday auto-settlement cron job.
 *
 * Runs every Thursday at 10:00 AM IST (04:30 UTC).
 * Controlled by ENABLE_PAYOUT_SCHEDULER=true env var.
 *
 * Flow per role:
 *  1. Check SettlementSchedule.isPaused
 *  2. Gather eligible partner IDs (pending commissions)
 *  3. For each partner: check eligibility, gather commissions, create payout, execute transfer
 *  4. Send partner notifications
 *  5. Alert admin on any failures
 *
 * Install: npm install node-cron    (add to backend/package.json)
 */

const prisma    = require('../../config/database');
const logger    = require('../../utils/logger');
const { decrypt } = require('../../utils/encryption');
const { checkPartnerEligibility, gatherEligibleCommissions, getEligiblePartnerIds } =
  require('./payoutEligibilityChecker');
const { executePayout } = require('./payoutExecutionService');
const { notifyPartner }  = require('../notification/partnerNotificationService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayThursday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const MAX_FAILURE_COUNT = 3; // auto-flag after this many consecutive failures

// ─── Settlement Runner ────────────────────────────────────────────────────────

const runSettlementForRole = async (role, { dryRun = false } = {}) => {
  const label = `[PayoutScheduler:${role}]`;

  // 1. Check pause flag
  const schedule = await prisma.settlementSchedule.findUnique({ where: { role } });
  if (schedule?.isPaused) {
    logger.warn(`${label} Settlement is paused (reason: ${schedule.pauseReason}). Skipping.`);
    return { skipped: true, reason: 'Settlement paused' };
  }

  const partnerIds = await getEligiblePartnerIds(role);
  logger.info(`${label} Found ${partnerIds.length} partner(s) with pending commissions`);

  const results = { paid: 0, failed: 0, skipped: 0, totalPaise: 0 };

  for (const partnerId of partnerIds) {
    const partnerLabel = `${label}[${partnerId.slice(-8)}]`;

    // 2. Eligibility
    const { eligible, reason } = await checkPartnerEligibility(partnerId);
    if (!eligible) {
      logger.warn(`${partnerLabel} Ineligible: ${reason}`);
      results.skipped++;
      continue;
    }

    // 3. Commission tally
    const { commissions, adjustments, totalPaise } = await gatherEligibleCommissions(partnerId, role);
    if (totalPaise <= 0) {
      logger.info(`${partnerLabel} Net eligible amount is ₹0 — skipping`);
      results.skipped++;
      continue;
    }

    if (dryRun) {
      logger.info(`${partnerLabel} DRY RUN — would pay ₹${(totalPaise / 100).toFixed(2)}`);
      results.paid++;
      results.totalPaise += totalPaise;
      continue;
    }

    // 4. Create payout record + lock commissions (atomic)
    let payoutRecord;
    try {
      payoutRecord = await prisma.$transaction(async (tx) => {
        const payout = await tx[role === 'CC' ? 'ccPayout' : 'cclPayout'].create({
          data: {
            [role === 'CC' ? 'ccUserId' : 'cclUserId']: partnerId,
            amountPaise:  totalPaise,
            status:       'processing',
            scheduledFor: todayThursday(),
          },
        });

        // Lock commissions into this payout
        const commissionIds = commissions.map((c) => c.id);
        if (role === 'CC') {
          await tx.ccCommission.updateMany({
            where: { id: { in: commissionIds } },
            data:  { status: 'in_payout', payoutId: payout.id },
          });
        } else {
          await tx.cclCommission.updateMany({
            where: { id: { in: commissionIds } },
            data:  { status: 'in_payout', payoutId: payout.id },
          });
        }

        return payout;
      });
    } catch (txErr) {
      logger.error(`${partnerLabel} DB transaction failed — skipping`, { error: txErr.message });
      results.failed++;
      continue;
    }

    // 5. Load bank account and snapshot it
    const bankAccount = await prisma.bankAccount.findUnique({ where: { userId: partnerId } });

    const bankAccountSnapshot = {
      accountHolder: bankAccount.accountHolder,
      ifscCode:      bankAccount.ifscCode,
      bankName:      bankAccount.bankName,
      accountType:   bankAccount.accountType,
      last4:         bankAccount.accountNumberLast4,
    };

    // Decrypt account number for transfer
    const decryptedAccountNumber = decrypt(bankAccount.accountNumberEnc);
    const bankForTransfer = { ...bankAccount, accountNumberEnc: decryptedAccountNumber };

    // Store snapshot
    await prisma[role === 'CC' ? 'ccPayout' : 'cclPayout'].update({
      where: { id: payoutRecord.id },
      data:  { bankAccountSnapshot, transferInitiatedAt: new Date() },
    });

    // 6. Execute transfer
    const { success, transferRef, error } = await executePayout(payoutRecord, bankForTransfer, role);

    if (success) {
      await prisma.$transaction(async (tx) => {
        await tx[role === 'CC' ? 'ccPayout' : 'cclPayout'].update({
          where: { id: payoutRecord.id },
          data:  { status: 'paid', processedAt: new Date(), transferRef, failureCount: 0 },
        });
        await tx[role === 'CC' ? 'ccCommission' : 'cclCommission'].updateMany({
          where: { payoutId: payoutRecord.id },
          data:  { status: 'paid' },
        });
      });

      results.paid++;
      results.totalPaise += totalPaise;
      logger.info(`${partnerLabel} Payout paid ✓ ref=${transferRef} amount=₹${(totalPaise / 100).toFixed(2)}`);

      notifyPartner(partnerId, 'payout_paid', {
        amountRupees: (totalPaise / 100).toFixed(2),
        reference:    transferRef,
        date:         new Date().toISOString().slice(0, 10),
      }).catch(() => {});

    } else {
      // Revert commissions to pending
      const newFailureCount = (payoutRecord.failureCount || 0) + 1;
      const shouldFlag = newFailureCount >= MAX_FAILURE_COUNT;

      await prisma.$transaction(async (tx) => {
        await tx[role === 'CC' ? 'ccPayout' : 'cclPayout'].update({
          where: { id: payoutRecord.id },
          data:  {
            status:       'failed',
            notes:        error,
            failureCount: newFailureCount,
            isFlagged:    shouldFlag,
          },
        });
        await tx[role === 'CC' ? 'ccCommission' : 'cclCommission'].updateMany({
          where: { payoutId: payoutRecord.id },
          data:  { status: 'pending', payoutId: null },
        });
      });

      if (shouldFlag) {
        await prisma.payoutFraudFlag.create({
          data: {
            role,
            partnerId,
            payoutId: payoutRecord.id,
            reason:   `Auto-flagged: ${MAX_FAILURE_COUNT} consecutive transfer failures. Last error: ${error}`,
          },
        });
        logger.warn(`${partnerLabel} Partner auto-flagged after ${MAX_FAILURE_COUNT} failures`);
      }

      results.failed++;
      logger.error(`${partnerLabel} Payout FAILED`, { error });
      notifyPartner(partnerId, 'payout_failed', { error }).catch(() => {});
    }
  }

  return results;
};

/**
 * Run full Thursday settlement for both CC and CCL.
 * @param {{ dryRun?: boolean }} options
 * @returns {Promise<{ CC: object, CCL: object }>}
 */
const runSettlement = async ({ dryRun = false } = {}) => {
  // Check ALL pause first
  const allSchedule = await prisma.settlementSchedule.findUnique({ where: { role: 'ALL' } });
  if (allSchedule?.isPaused) {
    logger.warn('[PayoutScheduler] ALL settlements paused. Skipping full run.');
    return { skipped: true, reason: 'All settlements paused' };
  }

  logger.info(`[PayoutScheduler] Thursday settlement run started dryRun=${dryRun}`);
  const [ccResults, cclResults] = await Promise.all([
    runSettlementForRole('CC',  { dryRun }),
    runSettlementForRole('CCL', { dryRun }),
  ]);

  const totalFailed = (ccResults.failed || 0) + (cclResults.failed || 0);
  if (totalFailed > 0) {
    // Alert admin by email
    try {
      const { sendEmail } = require('../email/emailService');
      await sendEmail({
        to:      process.env.ADMIN_ALERT_EMAIL || 'admin@cadgurukul.com',
        subject: `[CAD Gurukul] Payout failures: ${totalFailed} partner(s) not paid`,
        html: `<p>${totalFailed} payout(s) failed in the Thursday settlement run.</p>
               <p>CC: paid=${ccResults.paid}, failed=${ccResults.failed}, skipped=${ccResults.skipped}</p>
               <p>CCL: paid=${cclResults.paid}, failed=${cclResults.failed}, skipped=${cclResults.skipped}</p>
               <p>Please check the Admin Payout dashboard to review and retry.</p>`,
      });
    } catch (_) {}
  }

  logger.info('[PayoutScheduler] Thursday settlement run complete', { ccResults, cclResults });
  return { CC: ccResults, CCL: cclResults };
};

// ─── Cron Registration ────────────────────────────────────────────────────────

const start = () => {
  if (process.env.ENABLE_PAYOUT_SCHEDULER !== 'true') {
    logger.info('[PayoutScheduler] Disabled (ENABLE_PAYOUT_SCHEDULER !== true)');
    return;
  }

  let cron;
  try {
    cron = require('node-cron');
  } catch {
    logger.error('[PayoutScheduler] node-cron not installed. Run: npm install node-cron');
    return;
  }

  const schedule = process.env.SETTLEMENT_CRON || '30 4 * * 4'; // Thu 04:30 UTC = 10:00 IST
  cron.schedule(schedule, () => {
    runSettlement().catch((err) =>
      logger.error('[PayoutScheduler] Unhandled error in settlement run', { error: err.message })
    );
  }, { timezone: 'UTC' });

  logger.info(`[PayoutScheduler] Scheduled: "${schedule}" (UTC)`);
};

module.exports = { start, runSettlement, runSettlementForRole };
