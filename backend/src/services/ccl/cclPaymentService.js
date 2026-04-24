'use strict';
/**
 * CCL Payment Service
 * ─────────────────────────────────────────────────────────────────
 * Shared atomic service for creating an attributed sale + commission
 * when a joining link payment succeeds. Used by both the frontend
 * verify endpoint and the Razorpay server webhook for idempotency.
 *
 * Idempotency guarantee:
 *   CclAttributedSale.paymentId has a @unique constraint.
 *   A second call with the same paymentId returns the existing record
 *   gracefully rather than throwing a duplicate-key error.
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const COMMISSION_RATE = 0.10; // 10% of net sale amount

/**
 * createCclSaleAndCommission
 *
 * Atomically creates:
 *   1. CclAttributedSale  — ledger record for the sale
 *   2. CclCommission      — 10% commission record (status: pending)
 *   3. Updates the CclJoiningLink — marks as used, stores paymentId
 *   4. ActivityLog entry  — audit trail
 *
 * @param {object} params
 * @param {string} params.cclUserId
 * @param {string} params.joiningLinkId
 * @param {string} params.paymentId       - Razorpay payment ID (idempotency key)
 * @param {string} params.razorpayPaymentId
 * @param {number} params.grossAmountPaise - fee before discount
 * @param {number} params.discountAmountPaise - discount applied (≥0)
 * @param {number} params.netAmountPaise   - pre-tax net amount (GST excluded)
 * @returns {{ sale, commission, isNew }}
 */
async function createCclSaleAndCommission({
  cclUserId,
  joiningLinkId,
  paymentId,
  razorpayPaymentId,
  grossAmountPaise,
  discountAmountPaise = 0,
  netAmountPaise,
}) {
  const commissionPaise = Math.round(netAmountPaise * COMMISSION_RATE);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Idempotency check ───────────────────────────────────────────────────
      const existing = await tx.cclAttributedSale.findUnique({ where: { paymentId } });
      if (existing) {
        logger.info('[CCL] Duplicate payment — returning existing sale', { paymentId });
        return { sale: existing, commission: null, isNew: false };
      }

      // ── Create attributed sale ──────────────────────────────────────────────
      const sale = await tx.cclAttributedSale.create({
        data: {
          cclUserId,
          joiningLinkId,
          paymentId,
          saleType: 'joining',
          grossAmountPaise,
          discountAmountPaise,
          netAmountPaise,
          commissionPaise,
          status: 'confirmed',
        },
      });

      // ── Create commission record ────────────────────────────────────────────
      const commission = await tx.cclCommission.create({
        data: {
          cclUserId,
          attributedSaleId: sale.id,
          amountPaise: commissionPaise,
          status: 'pending',
        },
      });

      // ── Mark joining link as used ───────────────────────────────────────────
      if (joiningLinkId) {
        await tx.cclJoiningLink.update({
          where: { id: joiningLinkId },
          data: {
            isUsed: true,
            usedAt: new Date(),
            joiningPaymentId: razorpayPaymentId,
            joiningPaymentStatus: 'captured',
          },
        });
      }

      // ── Audit log (non-fatal if it fails) ──────────────────────────────────
      await tx.activityLog.create({
        data: {
          userId: cclUserId,
          action: 'ccl.sale.created',
          entityType: 'CclAttributedSale',
          entityId: sale.id,
          metadata: {
            commissionPaise,
            grossAmountPaise,
            discountAmountPaise,
            netAmountPaise,
            paymentId,
            joiningLinkId,
          },
        },
      }).catch((e) => logger.warn('[CCL] Audit log write failed', { error: e.message }));

      logger.info('[CCL] Sale and commission created', {
        saleId: sale.id,
        cclUserId,
        netAmountPaise,
        commissionPaise,
      });

      return { sale, commission, isNew: true };
    });

    return result;
  } catch (err) {
    // Prisma unique-constraint violation on paymentId → already processed
    if (err.code === 'P2002' && err.meta?.target?.includes?.('paymentId')) {
      const existing = await prisma.cclAttributedSale.findUnique({ where: { paymentId } });
      logger.info('[CCL] Race-condition duplicate payment resolved', { paymentId });
      return { sale: existing, commission: null, isNew: false };
    }
    throw err;
  }
}

module.exports = { createCclSaleAndCommission };
