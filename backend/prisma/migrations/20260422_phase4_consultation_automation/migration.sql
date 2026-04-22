-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260422_phase4_consultation_automation
-- Phase 4: reminder + follow-up + report-delivery tracking for consultations
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "consultation_bookings"
  ADD COLUMN "reminder24hSentAt" TIMESTAMP(3),
  ADD COLUMN "reminder2hSentAt" TIMESTAMP(3),
  ADD COLUMN "followUpSentAt" TIMESTAMP(3),
  ADD COLUMN "counsellingReportSentAt" TIMESTAMP(3);
