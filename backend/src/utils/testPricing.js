'use strict';
/**
 * ─── TEMPORARY TEST PRICING OVERRIDE ───────────────────────────────────────
 *
 * PURPOSE:
 *   Allows end-to-end payment testing with real Razorpay (test mode keys)
 *   without having to transact at full catalog prices.
 *
 * HOW TO ENABLE:
 *   Set in backend/.env:
 *     PAYMENT_TEST_MODE=true
 *
 * HOW TO DISABLE (revert to production pricing):
 *   Remove or set to false:
 *     PAYMENT_TEST_MODE=false
 *
 * TEST PRICE MAP (paise):
 *   ₹499  plan  (49900 paise)  → ₹1  (100 paise)
 *   ₹1999 plan  (199900 paise) → ₹2  (200 paise)
 *   ₹9999 plan  (999900 paise) → ₹3  (300 paise)
 *
 * IMPORTANT:
 *   - Only the amount sent to Razorpay is reduced.
 *   - The catalog/original amount is stored in the DB (Payment.amountPaise)
 *     and in Payment.metadata.originalAmountPaise so reports, admin views,
 *     and analytics all reflect the real plan price.
 *   - Webhook and verify flows are unaffected — they do NOT validate amount.
 *   - CCL and CC payment flows are NOT affected (they use separate services).
 *
 * TO FULLY REVERT THIS FILE:
 *   git checkout restore/pre-test-pricing -- backend/src/utils/testPricing.js
 *   (or simply delete this file and remove the single call site in payment.controller.js)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IS_TEST_MODE = process.env.PAYMENT_TEST_MODE === 'true';

/**
 * Maps catalog paise amounts to test paise amounts.
 * Any amount not in the map is returned unchanged.
 */
const TEST_PRICE_MAP = {
  49900:  100,   // ₹499 → ₹1
  199900: 200,   // ₹1,999 → ₹2
  999900: 300,   // ₹9,999 → ₹3
};

/**
 * Returns the amount that should actually be sent to Razorpay.
 *
 * In PRODUCTION (PAYMENT_TEST_MODE != 'true'): returns originalAmountPaise unchanged.
 * In TEST MODE  (PAYMENT_TEST_MODE = 'true'):  returns the mapped test amount.
 *
 * @param {number} originalAmountPaise  - catalog price in paise
 * @returns {{ chargeAmountPaise: number, isTestMode: boolean }}
 */
function getEffectiveChargeAmount(originalAmountPaise) {
  if (!IS_TEST_MODE) {
    return { chargeAmountPaise: originalAmountPaise, isTestMode: false };
  }

  const testAmount = TEST_PRICE_MAP[originalAmountPaise];
  if (testAmount === undefined) {
    // Unknown amount — pass through unchanged (safe fallback)
    return { chargeAmountPaise: originalAmountPaise, isTestMode: true };
  }

  return { chargeAmountPaise: testAmount, isTestMode: true };
}

module.exports = { getEffectiveChargeAmount, IS_TEST_MODE };
