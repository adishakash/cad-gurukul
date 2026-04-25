-- Add CC referral code to users
-- Required for counsellor referral link endpoint

ALTER TABLE "users" ADD COLUMN "ccReferralCode" TEXT;
CREATE UNIQUE INDEX "users_ccReferralCode_key" ON "users"("ccReferralCode");
