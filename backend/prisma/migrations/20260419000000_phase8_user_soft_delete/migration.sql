-- Phase 8: Add soft-delete support to the users table
-- Adds deletedAt (nullable timestamp) for GDPR-safe account deletion.
-- The application sets isActive=false and deletedAt=now() when a user deletes their account.
-- The email is anonymised at deletion time so the address can be reused.

ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
