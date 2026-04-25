export const initReferralFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  const referral = params.get('ref') || params.get('referral') || params.get('cc')
  if (referral) {
    localStorage.setItem('cg_referral_code', referral.toUpperCase())
  }
  const coupon = params.get('coupon')
  if (coupon) {
    localStorage.setItem('cg_coupon_code', coupon.toUpperCase())
  }
}

export const getStoredReferralCode = () => localStorage.getItem('cg_referral_code') || ''
export const getStoredCouponCode = () => localStorage.getItem('cg_coupon_code') || ''
