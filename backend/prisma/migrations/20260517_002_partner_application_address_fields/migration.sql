-- Migration: partner_application_address_fields
-- Adds missing address fields required by partner onboarding forms.

ALTER TABLE "partner_applications"
  ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "pincode" TEXT;
