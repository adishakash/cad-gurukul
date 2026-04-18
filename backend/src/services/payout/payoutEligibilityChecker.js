'use strict';
/**
 * Payout Eligibility Checker
 *
 * Determines whether a partner is eligible for payout and which
 * commission records should be included in the next Thursday batch.
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Check whether a partner is eligible to receive a payout.
 *
 * Eligibility conditions:
 *  1. user.isApproved === true
 *  2. user.isActive === true  (not deactivated/suspended)
 *  3. bankAccount exists and bankAccount.isVerified === true
 *  4. No open PayoutFraudFlag (status = 'open' or 'investigating')
 *
 * @param {string} userId
 * @returns {Promise<{ eligible: boolean, reason?: string }>}
 */
const checkPartnerEligibility = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isApproved: true,
      isActive: true,
      bankAccount: { select: { isVerified: true } },
    },
  });

  if (!user) return { eligible: false, reason: 'User not found' };
  if (!user.isActive)   return { eligible: false, reason: 'Account inactive' };
  if (!user.isApproved) return { eligible: false, reason: 'Not yet approved' };
  if (!user.bankAccount)           return { eligible: false, reason: 'No bank account on file' };
  if (!user.bankAccount.isVerified) return { eligible: false, reason: 'Bank account not verified' };

  // Check for open fraud flags
  const openFlag = await prisma.payoutFraudFlag.findFirst({
    where: { partnerId: userId, status: { in: ['open', 'investigating'] } },
  });
  if (openFlag) return { eligible: false, reason: `Payout flagged: ${openFlag.reason}` };

  return { eligible: true };
};

/**
 * Gather all pending commissions + pending adjustments for a given partner/role.
 * Used by the scheduler and by on-demand admin trigger.
 *
 * @param {string} partnerId
 * @param {'CC' | 'CCL'} role
 * @returns {Promise<{ commissions: object[], adjustments: object[], totalPaise: number }>}
 */
const gatherEligibleCommissions = async (partnerId, role) => {
  let commissions = [];
  if (role === 'CC') {
    commissions = await prisma.ccCommission.findMany({
      where: {
        ccUserId: partnerId,
        status: 'pending',
        attributedSale: { status: 'confirmed' },
      },
      select: { id: true, amountPaise: true },
    });
  } else {
    commissions = await prisma.cclCommission.findMany({
      where: {
        cclUserId: partnerId,
        status: 'pending',
        attributedSale: { status: 'confirmed' },
      },
      select: { id: true, amountPaise: true },
    });
  }

  // Pending adjustments (credit/debit)
  const adjustments = await prisma.commissionAdjustment.findMany({
    where: { partnerId, role },
  });

  const commissionSum   = commissions.reduce((s, c) => s + c.amountPaise, 0);
  const adjustmentSum   = adjustments.reduce((s, a) => s + a.amountPaise, 0); // can be negative
  const totalPaise      = Math.max(0, commissionSum + adjustmentSum);

  return { commissions, adjustments, totalPaise };
};

/**
 * Get all unique partnerIds that have pending eligible commissions for a given role.
 *
 * @param {'CC' | 'CCL'} role
 * @returns {Promise<string[]>}
 */
const getEligiblePartnerIds = async (role) => {
  if (role === 'CC') {
    const rows = await prisma.ccCommission.findMany({
      where: { status: 'pending', attributedSale: { status: 'confirmed' } },
      distinct: ['ccUserId'],
      select: { ccUserId: true },
    });
    return rows.map((r) => r.ccUserId);
  }

  const rows = await prisma.cclCommission.findMany({
    where: { status: 'pending', attributedSale: { status: 'confirmed' } },
    distinct: ['cclUserId'],
    select: { cclUserId: true },
  });
  return rows.map((r) => r.cclUserId);
};

module.exports = {
  checkPartnerEligibility,
  gatherEligibleCommissions,
  getEligiblePartnerIds,
};
