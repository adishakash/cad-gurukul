-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260422_phase2_consultation_scheduler
-- Phase 2: Exact consultation scheduling + admin availability blocks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "consultation_bookings"
  ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
  ADD COLUMN "scheduledEndAt" TIMESTAMP(3),
  ADD COLUMN "scheduledTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN "meetingProvider" TEXT NOT NULL DEFAULT 'JITSI',
  ADD COLUMN "meetingRoomName" TEXT,
  ADD COLUMN "meetingConfirmedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "consultation_bookings_scheduledStartAt_key"
  ON "consultation_bookings"("scheduledStartAt");

CREATE INDEX "consultation_bookings_scheduledStartAt_idx"
  ON "consultation_bookings"("scheduledStartAt");

CREATE TABLE "consultation_availability_blocks" (
  "id"         TEXT NOT NULL,
  "startsAt"   TIMESTAMP(3) NOT NULL,
  "endsAt"     TIMESTAMP(3) NOT NULL,
  "timezone"   TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "isFullDay"  BOOLEAN NOT NULL DEFAULT false,
  "reason"     TEXT,
  "createdBy"  TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultation_availability_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consultation_availability_blocks_startsAt_endsAt_idx"
  ON "consultation_availability_blocks"("startsAt", "endsAt");

CREATE INDEX "consultation_availability_blocks_isActive_idx"
  ON "consultation_availability_blocks"("isActive");
