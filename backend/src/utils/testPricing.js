'use strict';
/**
 * ════════════════════════════════════════════════════════════════════════════
 *  TEST PRICING OVERRIDE  —  backend/src/utils/testPricing.js
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  PURPOSE
 *  ───────
 *  Allows complete end-to-end payment testing with real Razorpay test-mode
 *  keys without transacting at catalog prices.
 *
 *  ACTIVATION
 *  ──────────
 *  backend/.env:  PAYMENT_TEST_MODE=true
 *  To disable:    PAYMENT_TEST_MODE=false  (or remove the variable)
 *
 *  ┌─────────────────────────────────────────────────────────────────────┐
 *  │  CANONICAL PRICING MATRIX  (when PAYMENT_TEST_MODE=true)           │
 *  │                                                                     │
 *  │  Direct plan purchases                                              │
 *  │    free  → standard      (₹499)   Razorpay charge → ₹1.00         │
 *  │    free  → premium       (₹1,999) Razorpay charge → ₹1.00         │
 *  │    free  → consultation  (₹9,999) Razorpay charge → ₹1.00         │
 *  │                                                                     │
 *  │  Upgrade between paid plans                                         │
 *  │    standard → premium              Razorpay charge → ₹0.10        │
 *  │    premium  → consultation         Razorpay charge → ₹0.10        │
 *  │    standard → consultation         Razorpay charge → ₹0.10        │
 *  │                                                                     │
 *  │  CCL counsellor joining fee (any amount)                            │
 *  │                                   Razorpay charge → ₹0.10         │
 *  └─────────────────────────────────────────────────────────────────────┘
 *
 *  ARCHITECTURE CONTRACT
 *  ─────────────────────
 *  1.  buildQuote()  in payment.controller.js is the SINGLE source of
 *      truth for what the user sees AND what Razorpay is charged.
 *      It uses IS_TEST_MODE + TEST_BASE_PAISE / TEST_UPGRADE_PAISE.
 *
 *  2.  Payment.amountPaise in the DB ALWAYS stores the REAL catalog price
 *      (from quote.catalogPrice), NOT the test amount.
 *      This keeps admin revenue, CSV exports, and financial totals correct.
 *
 *  3.  Payment.metadata.testMode = true and
 *      Payment.metadata.chargeAmountPaise = <test paise>
 *      are added to every test-mode record so the payment list can surface
 *      a visual badge and the discrepancy is never hidden.
 *
 *  4.  getEffectiveChargeAmount() below is a safety-net fallback only.
 *      It should never be called with catalog-range paise values in practice
 *      because buildQuote() already converts them to test amounts.
 *
 *  5.  CCL joining fee override lives in ccl.controller.js / createJoiningOrder
 *      and follows the same contract: real gross stored, test amount charged.
 *
 *  REVERT
 *  ──────
 *  Set PAYMENT_TEST_MODE=false.  No code changes required.
 * ════════════════════════════════════════════════════════════════════════════
 */

const IS_TEST_MODE = process.env.PAYMENT_TEST_MODE === 'true';

// ── Symbolic test amounts (paise) ────────────────────────────────────────────
// These are the ONLY amounts sent to Razorpay when IS_TEST_MODE is true.
const TEST_BASE_PAISE        = 100;  // ₹1.00  — any direct plan purchase
const TEST_UPGRADE_PAISE     = 10;   // ₹0.10  — any upgrade between paid plans
const TEST_JOINING_FEE_PAISE = 10;   // ₹0.10  — CCL counsellor joining fee

// Human-readable labels for UI consistency
const TEST_BASE_LABEL        = '₹1';
const TEST_UPGRADE_LABEL     = '₹0.10';
const TEST_JOINING_FEE_LABEL = '₹0.10';

// ── Safety-net fallback map ───────────────────────────────────────────────────
// Only triggered if a catalog-range paise amount bypasses buildQuote().
// Maps known catalog amounts → TEST_BASE_PAISE.
const TEST_PRICE_MAP = {
  49900:  TEST_BASE_PAISE,   // ₹499  → ₹1
  199900: TEST_BASE_PAISE,   // ₹1999 → ₹1
  999900: TEST_BASE_PAISE,   // ₹9999 → ₹1
};

/**
 * Safety-net: clips known catalog paise amounts to the test base price.
 * The primary test-mode override is in buildQuote(); this is a last-resort guard.
 *
 * In PRODUCTION (PAYMENT_TEST_MODE != 'true'): returns originalAmountPaise unchanged.
 * In TEST MODE  (PAYMENT_TEST_MODE = 'true'):  maps catalog amounts; passes others through.
 *
 * @param {number} originalAmountPaise
 * @returns {{ chargeAmountPaise: number, isTestMode: boolean }}
 */
function getEffectiveChargeAmount(originalAmountPaise) {
  if (!IS_TEST_MODE) {
    return { chargeAmountPaise: originalAmountPaise, isTestMode: false };
  }

  const testAmount = TEST_PRICE_MAP[originalAmountPaise];
  if (testAmount === undefined) {
    // Already a test amount or unknown amount — pass through unchanged.
    return { chargeAmountPaise: originalAmountPaise, isTestMode: true };
  }

  return { chargeAmountPaise: testAmount, isTestMode: true };
}

module.exports = {
  IS_TEST_MODE,
  TEST_BASE_PAISE,
  TEST_UPGRADE_PAISE,
  TEST_JOINING_FEE_PAISE,
  TEST_BASE_LABEL,
  TEST_UPGRADE_LABEL,
  TEST_JOINING_FEE_LABEL,
  getEffectiveChargeAmount,
};
