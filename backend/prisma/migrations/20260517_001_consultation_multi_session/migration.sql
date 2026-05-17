-- Migration: consultation_multi_session
-- Adds sessionNumber and totalSessions to consultation_bookings.
-- Replaces the paymentId @unique constraint with a composite unique on (paymentId, sessionNumber).
--
-- Plan rules:
--   premium      (₹1,999) → 1 consultation session
--   consultation (₹9,999) → 6 consultation sessions

-- 1. Drop the old unique index on paymentId
ALTER TABLE "consultation_bookings" DROP CONSTRAINT IF EXISTS "consultation_bookings_paymentId_key";

-- 2. Add the new columns with safe defaults so existing rows are valid
ALTER TABLE "consultation_bookings"
  ADD COLUMN IF NOT EXISTS "sessionNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalSessions"  INTEGER NOT NULL DEFAULT 1;

-- 3. Add the new composite unique constraint
ALTER TABLE "consultation_bookings"
  ADD CONSTRAINT "consultation_bookings_paymentId_sessionNumber_key"
  UNIQUE ("paymentId", "sessionNumber");

-- 4. Add a plain index on paymentId for fast lookups
CREATE INDEX IF NOT EXISTS "consultation_bookings_paymentId_idx"
  ON "consultation_bookings" ("paymentId");
