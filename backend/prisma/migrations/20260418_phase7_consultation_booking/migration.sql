-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260418_phase7_consultation_booking
-- Phase 7: Consultation booking + slot-selection workflow
--
-- Creates the consultation_bookings table to track the full lifecycle of a
-- ₹9,999 career counselling session: slot-mail-sent → slot-selected →
-- meeting-scheduled → meeting-completed → counselling-report-ready.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "consultation_bookings" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "leadId"                TEXT,
    "paymentId"             TEXT NOT NULL,
    "slotToken"             TEXT NOT NULL,
    "counsellorName"        TEXT NOT NULL DEFAULT 'Adish Gupta',
    "counsellorExpertise"   TEXT NOT NULL DEFAULT 'Career Guidance Specialist | 10+ years | IIT Alumni',
    "counsellorContact"     TEXT NOT NULL DEFAULT 'adish@cadgurukul.com',
    "selectedSlot"          TEXT,
    "slotSelectedAt"        TIMESTAMP(3),
    "status"                TEXT NOT NULL DEFAULT 'slot_mail_sent',
    "meetingDate"           TIMESTAMP(3),
    "meetingLink"           TEXT,
    "meetingNotes"          TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consultation_bookings_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "consultation_bookings_paymentId_key" ON "consultation_bookings"("paymentId");
CREATE UNIQUE INDEX "consultation_bookings_slotToken_key" ON "consultation_bookings"("slotToken");

-- Lookup indices
CREATE INDEX "consultation_bookings_userId_idx"  ON "consultation_bookings"("userId");
CREATE INDEX "consultation_bookings_status_idx"  ON "consultation_bookings"("status");

-- Foreign key: user
ALTER TABLE "consultation_bookings"
    ADD CONSTRAINT "consultation_bookings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: lead (nullable — SET NULL so deleting a lead doesn't cascade to booking)
ALTER TABLE "consultation_bookings"
    ADD CONSTRAINT "consultation_bookings_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
