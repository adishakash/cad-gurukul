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

const formatRupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

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
