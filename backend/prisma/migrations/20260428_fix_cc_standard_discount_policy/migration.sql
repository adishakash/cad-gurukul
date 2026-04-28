-- Fix: DiscountPolicy for CAREER_COUNSELLOR / standard plan must allow 100% off.
-- The default maxPct of 20 was incorrectly applied to the ₹499 plan.
-- Business rules:
--   CAREER_COUNSELLOR / standard      → maxPct = 100
--   CAREER_COUNSELLOR / premium       → maxPct = 20  (unchanged)
--   CAREER_COUNSELLOR / consultation  → maxPct = 20  (unchanged)

UPDATE "DiscountPolicy"
SET    "maxPct" = 100,
       "minPct" = 0,
       "updatedAt" = NOW()
WHERE  "role"     = 'CAREER_COUNSELLOR'
  AND  "planType" = 'standard'
  AND  "maxPct"  <  100;
