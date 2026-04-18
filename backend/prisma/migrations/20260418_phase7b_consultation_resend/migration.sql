-- Phase 7b: Add resend tracking to consultation_bookings
-- Allows rate-limiting and UX feedback for slot-email resend requests.

ALTER TABLE "consultation_bookings"
  ADD COLUMN "lastResendAt" TIMESTAMP(3),
  ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;
