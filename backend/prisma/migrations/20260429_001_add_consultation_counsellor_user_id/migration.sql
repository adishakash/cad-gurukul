-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260429_001_add_consultation_counsellor_user_id
-- Fix: add missing ConsultationBooking.counsellorUserId column expected by Prisma
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "consultation_bookings"
  ADD COLUMN IF NOT EXISTS "counsellorUserId" TEXT;

CREATE INDEX IF NOT EXISTS "consultation_bookings_counsellorUserId_idx"
  ON "consultation_bookings"("counsellorUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_bookings_counsellorUserId_fkey'
  ) THEN
    ALTER TABLE "consultation_bookings"
      ADD CONSTRAINT "consultation_bookings_counsellorUserId_fkey"
      FOREIGN KEY ("counsellorUserId")
      REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
