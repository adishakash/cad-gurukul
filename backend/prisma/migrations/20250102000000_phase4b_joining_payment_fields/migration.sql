-- Phase 4B: Add joining payment tracking fields to ccl_joining_links
-- These columns allow each joining link to track its own Razorpay order/payment,
-- enabling the end-to-end payment flow without touching the existing payments table.
-- All changes are additive — no existing data is affected.

ALTER TABLE "ccl_joining_links"
  ADD COLUMN "joiningOrderId"        TEXT,
  ADD COLUMN "joiningPaymentId"      TEXT,
  ADD COLUMN "joiningPaymentStatus"  TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "joiningNetAmountPaise" INTEGER;

-- Unique index on joiningOrderId (one Razorpay order per joining link slot)
CREATE UNIQUE INDEX "ccl_joining_links_joiningOrderId_key"
  ON "ccl_joining_links"("joiningOrderId");

-- Index to look up joining links by Razorpay orderId (webhook routing)
CREATE INDEX "ccl_joining_links_joiningOrderId_idx"
  ON "ccl_joining_links"("joiningOrderId");
