'use strict';
/**
 * Net Sales Calculator — single canonical source of truth for commission math.
 *
 * Net Sales = Gross Payment - Discount Applied - Platform Fee - Tax
 * CC  Commission = Net Sales × 0.70
 * CCL Commission = Net Sales × 0.10
 *
 * All amounts are in paise (integer). Fractions are floor()-ed to avoid
 * crediting more than collected.
 */

const CC_COMMISSION_RATE  = 0.70;
const CCL_COMMISSION_RATE = 0.10;
const MAX_DISCOUNT_PCT    = 20;

/**
 * Calculate net sales from payment components.
 *
 * @param {{
 *   grossAmountPaise: number,   // total collected from student/candidate
 *   discountAmountPaise?: number, // waived by partner discount (default 0)
 *   platformFeePct?: number,    // platform cut % (default 0, future use)
 *   taxPaise?: number,          // GST/tax component (default 0, future use)
 * }} params
 * @returns {{ netAmountPaise: number, platformFeePaise: number }}
 */
const calculateNetSales = ({
  grossAmountPaise,
  discountAmountPaise = 0,
  platformFeePct = 0,
  taxPaise = 0,
}) => {
  if (grossAmountPaise < 0) throw new Error('grossAmountPaise must be >= 0');

  const platformFeePaise = Math.floor(grossAmountPaise * platformFeePct / 100);
  const netAmountPaise   = Math.max(
    0,
    grossAmountPaise - discountAmountPaise - platformFeePaise - taxPaise
  );

  return { netAmountPaise, platformFeePaise };
};

/**
 * Calculate CC (Career Counsellor) commission: 70% of net sales.
 * @param {number} netAmountPaise
 * @returns {number} commissionPaise (floored)
 */
const calculateCCCommission = (netAmountPaise) =>
  Math.floor(netAmountPaise * CC_COMMISSION_RATE);

/**
 * Calculate CCL (Career Counsellor Lead) commission: 10% of net sales.
 * @param {number} netAmountPaise
 * @returns {number} commissionPaise (floored)
 */
const calculateCCLCommission = (netAmountPaise) =>
  Math.floor(netAmountPaise * CCL_COMMISSION_RATE);

/**
 * Validate and clamp a discount percentage.
 * Throws if discount exceeds maxPct (default 20%).
 * @param {number} requestedPct
 * @param {number} maxPct
 * @returns {number} clamped discount pct
 */
const validateDiscountPct = (requestedPct, maxPct = MAX_DISCOUNT_PCT) => {
  const pct = Number(requestedPct) || 0;
  if (pct < 0) throw new Error('Discount cannot be negative');
  if (pct > maxPct) throw new Error(`Discount ${pct}% exceeds maxPct ${maxPct}%`);
  return pct;
};

/**
 * Compute discount amount from gross + pct.
 * @param {number} grossAmountPaise
 * @param {number} discountPct
 * @returns {number} discountAmountPaise (floored)
 */
const computeDiscountAmount = (grossAmountPaise, discountPct) =>
  Math.floor(grossAmountPaise * discountPct / 100);

module.exports = {
  calculateNetSales,
  calculateCCCommission,
  calculateCCLCommission,
  validateDiscountPct,
  computeDiscountAmount,
  CC_COMMISSION_RATE,
  CCL_COMMISSION_RATE,
  MAX_DISCOUNT_PCT,
};
