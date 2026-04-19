-- Phase 9: Add soft-delete support to the discount_policies table
-- Allows policies to be soft-deleted (archived) while preserving audit history.
-- deletedAt: timestamp when deleted; deletedBy: admin userId who deleted.

ALTER TABLE "discount_policies" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "discount_policies" ADD COLUMN "deletedBy" TEXT;
CREATE INDEX "discount_policies_deletedAt_idx" ON "discount_policies"("deletedAt");
