-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260420000000_phase_admin_v2_assignment_history
-- Phase Admin v2:
--   1. Lead assignment to CC / CCL staff
--   2. Training content soft-delete with audit trail
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Lead Assignment ───────────────────────────────────────────────────────────
-- Allow admin to assign exactly one CC/CCL to a lead.
-- Previous assignee loses access immediately on reassignment (FK swap).

ALTER TABLE "leads"
  ADD COLUMN "assignedStaffId" TEXT,
  ADD COLUMN "assignedAt"      TIMESTAMP(3),
  ADD COLUMN "assignedBy"      TEXT;

-- FK: assigned staff must be an existing user
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_assignedStaffId_fkey"
  FOREIGN KEY ("assignedStaffId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "leads_assignedStaffId_idx" ON "leads"("assignedStaffId");

-- ── Training Content Soft-Delete ──────────────────────────────────────────────
-- Preserve training history: record who deleted an item and when.
-- deletedAt = NULL means active (or just deactivated).
-- deletedAt != NULL means permanently removed from staff view but still auditable.

ALTER TABLE "ccl_training_content"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "ccl_training_content_deletedAt_idx" ON "ccl_training_content"("deletedAt");
