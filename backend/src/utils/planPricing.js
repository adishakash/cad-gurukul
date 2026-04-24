'use strict';

const PLAN_PRICES = {
  free: 0,
  standard: 499,
  premium: 1999,
  consultation: 9999,
};

const PLAN_ORDER = ['free', 'standard', 'premium', 'consultation'];
const PAID_STATUSES = ['payment_pending', 'paid', 'premium_report_generating', 'premium_report_ready', 'counselling_interested', 'closed'];

const getPlanRank = (planType = 'free') => PLAN_ORDER.indexOf(planType);

const normalizePlanType = (planType = 'free') => (PLAN_PRICES[planType] !== undefined ? planType : 'free');

const isPlanIncluded = (currentPlanType = 'free', targetPlanType = 'free') => (
  getPlanRank(normalizePlanType(currentPlanType)) >= getPlanRank(normalizePlanType(targetPlanType))
);

const getUpgradePrice = (currentPlanType = 'free', targetPlanType = 'free') => {
  const currentPrice = PLAN_PRICES[normalizePlanType(currentPlanType)] || 0;
  const targetPrice = PLAN_PRICES[normalizePlanType(targetPlanType)] || 0;
  return Math.max(0, targetPrice - currentPrice);
};

const formatRupees = (amount) => {
  const num = Number(amount || 0);
  // For fractional amounts < 1, always show 2 decimals (e.g. ₹0.10 not ₹0.1)
  if (num > 0 && num < 1) {
    return `₹${num.toFixed(2)}`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
};

module.exports = {
  PLAN_PRICES,
  PLAN_ORDER,
  PAID_STATUSES,
  getPlanRank,
  normalizePlanType,
  isPlanIncluded,
  getUpgradePrice,
  formatRupees,
};
