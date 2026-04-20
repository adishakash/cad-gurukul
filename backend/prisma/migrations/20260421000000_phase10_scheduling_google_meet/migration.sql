-- Phase 10: Scheduling & Google Meet integration
-- Adds AvailabilitySlot table and extends ConsultationBooking with
-- date-specific fields, Google Meet link storage, and meet-link email tracking.
-- All new ConsultationBooking columns are nullable for full backward compatibility.

-- ─── AvailabilitySlot ───────────────────────────────────────────────────────

CREATE TABLE "availability_slots" (
    "id"        TEXT NOT NULL,
    "date"      DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime"   TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "isBooked"  BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "bookingId" TEXT,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- Unique: no two slots on the same date can share the same startTime
CREATE UNIQUE INDEX "availability_slots_date_startTime_key"
    ON "availability_slots"("date", "startTime");

-- A bookingId can appear on at most one slot (1:1 to booking)
CREATE UNIQUE INDEX "availability_slots_bookingId_key"
    ON "availability_slots"("bookingId");

-- General query indexes
CREATE INDEX "availability_slots_date_idx"      ON "availability_slots"("date");
CREATE INDEX "availability_slots_isBooked_idx"  ON "availability_slots"("isBooked");
CREATE INDEX "availability_slots_isBlocked_idx" ON "availability_slots"("isBlocked");

-- FK: availability_slots.bookingId → consultation_bookings.id
ALTER TABLE "availability_slots"
    ADD CONSTRAINT "availability_slots_bookingId_fkey"
    FOREIGN KEY ("bookingId")
    REFERENCES "consultation_bookings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── ConsultationBooking — new columns ───────────────────────────────────────

-- Denormalised date/time from the chosen AvailabilitySlot
ALTER TABLE "consultation_bookings"
    ADD COLUMN IF NOT EXISTS "scheduledDate"      TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "scheduledStartTime" TEXT,
    ADD COLUMN IF NOT EXISTS "scheduledEndTime"   TEXT;

-- Google Calendar / Meet
ALTER TABLE "consultation_bookings"
    ADD COLUMN IF NOT EXISTS "googleMeetLink" TEXT,
    ADD COLUMN IF NOT EXISTS "googleEventId"  TEXT,
    ADD COLUMN IF NOT EXISTS "meetLinkSentAt" TIMESTAMP(3);
