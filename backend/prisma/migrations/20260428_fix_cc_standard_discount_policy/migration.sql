-- Fix 1: DiscountPolicy for CAREER_COUNSELLOR / standard plan must allow 100% off.
-- The default maxPct of 20 was incorrectly applied to the ₹499 plan.
UPDATE "discount_policies"
SET    "maxPct" = 100,
       "minPct" = 0,
       "updatedAt" = NOW()
WHERE  "role"     = 'CAREER_COUNSELLOR'
  AND  "planType" = 'standard'
  AND  "maxPct"  <  100;

-- Fix 2: Existing standard-plan coupons that were silently capped to 20% cannot be
-- automatically restored to the counsellor's intended value (it was never stored).
-- They are left as-is; counsellors can use the new "Edit %" button on the dashboard
-- to correct the discount on any affected coupon.
