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

export const formatRupees = (amount) => {
  const num = Number(amount || 0)
  // For fractional amounts < 1, always show 2 decimals (e.g. ₹0.10 not ₹0.1)
  if (num > 0 && num < 1) {
    return `₹${num.toFixed(2)}`
  }
  return `₹${num.toLocaleString('en-IN')}`
}
