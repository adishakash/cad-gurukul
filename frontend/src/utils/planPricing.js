export const PLAN_PRICES = {
  free: 0,
  standard: 499,
  premium: 1999,
  consultation: 9999,
}

export const PLAN_ORDER = ['free', 'standard', 'premium', 'consultation']

export const getPlanRank = (planType = 'free') => PLAN_ORDER.indexOf(planType)

export const isPlanIncluded = (currentPlanType = 'free', targetPlanType = 'free') =>
  getPlanRank(currentPlanType) >= getPlanRank(targetPlanType)

export const getUpgradePrice = (currentPlanType = 'free', targetPlanType = 'free') =>
  Math.max(0, (PLAN_PRICES[targetPlanType] || 0) - (PLAN_PRICES[currentPlanType] || 0))

export const formatRupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`
