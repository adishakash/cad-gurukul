const normalizeCode = (value) => (value || '').toString().trim()

const isValidCode = (value) => /^[A-Za-z0-9-]{2,50}$/.test(value)

export const storeReferralCode = (value) => {
  const normalized = normalizeCode(value)
  if (!normalized || !isValidCode(normalized)) return false
  localStorage.setItem('cg_referral_code', normalized.toUpperCase())
  return true
}

export const storeCouponCode = (value) => {
  const normalized = normalizeCode(value)
  if (!normalized || !isValidCode(normalized)) return false
  localStorage.setItem('cg_coupon_code', normalized.toUpperCase())
  return true
}

export const initReferralFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  const referral = params.get('ref') || params.get('referral') || params.get('cc')
  if (referral) storeReferralCode(referral)
  const coupon = params.get('coupon')
  if (coupon) storeCouponCode(coupon)
}

export const getStoredReferralCode = () => localStorage.getItem('cg_referral_code') || ''
export const getStoredCouponCode = () => localStorage.getItem('cg_coupon_code') || ''
