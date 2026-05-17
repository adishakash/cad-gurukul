-- Add CC payment control fields to users table
-- Allows super admins to pause automatic payout generation for specific CCs
-- and manually process their payouts instead.

ALTER TABLE "users"
ADD COLUMN "ccPaymentsPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paymentsPausedAt" TIMESTAMP(3),
ADD COLUMN "pausedBy" TEXT;

-- Index for faster queries of paused CCs
CREATE INDEX "users_ccPaymentsPaused_idx" ON "users"("ccPaymentsPaused");
