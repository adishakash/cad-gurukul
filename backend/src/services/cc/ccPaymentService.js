'use strict';
/**
 * CC Payment Service
 * ─────────────────────────────────────────────────────────────────
 * Shared atomic service for creating an attributed sale + commission
 * when a test link payment succeeds. Used by both the frontend
 * verify endpoint and the Razorpay server webhook for idempotency.
 *
 * Idempotency guarantee:
 *   CcAttributedSale.paymentId has a @unique constraint.
 *   A second call with the same paymentId returns the existing record
 *   gracefully rather than throwing a duplicate-key error.
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const DEFAULT_COMMISSION_RATE = 0.70; // 70% of net sale amount

/**
 * createCcSaleAndCommission
 *
 * Atomically creates:
 *   1. CcAttributedSale  — ledger record for the sale
 *   2. CcCommission      — 70% commission record (status: pending)
 *   3. Updates the CcTestLink — marks as used, stores paymentId
 *   4. ActivityLog entry  — audit trail
 *
 * @param {object} params
 * @param {string} params.ccUserId
 * @param {string} params.testLinkId
 * @param {string} params.paymentId       - Razorpay payment ID (idempotency key)
 * @param {string} params.razorpayPaymentId
 * @param {number} params.grossAmountPaise - fee before discount
 * @param {number} params.discountAmountPaise - discount applied (≥0)
 * @param {number} params.netAmountPaise   - pre-tax net amount (GST excluded)
 * @param {string} [params.saleType]
 * @param {string} [params.planType]
 * @param {number} [params.commissionRate]
 * @param {string} [params.ccCouponId]
 * @param {string} [params.couponCode]
 * @returns {{ sale, commission, isNew }}
 */
async function createCcSaleAndCommission({
  ccUserId,
  testLinkId,
  paymentId,
  razorpayPaymentId,
  grossAmountPaise,
  discountAmountPaise = 0,
  netAmountPaise,
  saleType = 'test_link',
  planType = 'standard',
  commissionRate = DEFAULT_COMMISSION_RATE,
  ccCouponId = null,
  couponCode = null,
}) {
  const commissionPaise = Math.round(netAmountPaise * commissionRate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── Idempotency check ───────────────────────────────────────────────────
      const existing = await tx.ccAttributedSale.findUnique({ where: { paymentId } });
      if (existing) {
        logger.info('[CC] Duplicate payment — returning existing sale', { paymentId });
        return { sale: existing, commission: null, isNew: false };
      }

      // ── Create attributed sale ──────────────────────────────────────────────
      const sale = await tx.ccAttributedSale.create({
        data: {
          ccUserId,
          testLinkId: testLinkId || null,
          paymentId,
          saleType,
          planType,
          grossAmountPaise,
          discountAmountPaise,
          netAmountPaise,
          commissionRate,
          commissionPaise,
          ccCouponId,
          couponCode,
          status: 'confirmed',
        },
      });

      // ── Create commission record ────────────────────────────────────────────
      const commission = await tx.ccCommission.create({
        data: {
          ccUserId,
          attributedSaleId: sale.id,
          amountPaise: commissionPaise,
          status: 'pending',
        },
      });

      // ── Mark test link as used ──────────────────────────────────────────────
      if (testLinkId) {
        await tx.ccTestLink.update({
          where: { id: testLinkId },
          data: {
            isUsed: true,
            usedAt: new Date(),
            testPaymentId: razorpayPaymentId,
            testPaymentStatus: 'captured',
          },
        });
      }

      if (ccCouponId) {
        await tx.ccCoupon.update({
          where: { id: ccCouponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // ── Audit log (non-fatal if it fails) ──────────────────────────────────
      await tx.activityLog.create({
        data: {
          userId: ccUserId,
          action: 'cc.sale.created',
          entityType: 'CcAttributedSale',
          entityId: sale.id,
          metadata: {
            commissionPaise,
            commissionRate,
            grossAmountPaise,
            discountAmountPaise,
            netAmountPaise,
            paymentId,
            testLinkId,
            planType,
            ccCouponId,
            couponCode,
          },
        },
      }).catch((e) => logger.warn('[CC] Audit log write failed', { error: e.message }));

      logger.info('[CC] Sale and commission created', {
        saleId: sale.id,
        ccUserId,
        netAmountPaise,
        commissionPaise,
      });

      return { sale, commission, isNew: true };
    });

    return result;
  } catch (err) {
    // Prisma unique-constraint violation on paymentId → already processed
    if (err.code === 'P2002' && err.meta?.target?.includes?.('paymentId')) {
      const existing = await prisma.ccAttributedSale.findUnique({ where: { paymentId } });
      logger.info('[CC] Race-condition duplicate payment resolved', { paymentId });
      return { sale: existing, commission: null, isNew: false };
    }
    throw err;
  }
}

module.exports = { createCcSaleAndCommission };
