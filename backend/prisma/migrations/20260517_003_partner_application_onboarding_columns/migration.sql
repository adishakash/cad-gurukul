-- Migration: partner_application_onboarding_columns
-- Ensures all partner onboarding/payment columns exist on partner_applications.
-- Safe to run multiple times.

ALTER TABLE "partner_applications"
  ADD COLUMN IF NOT EXISTS "addressLine" TEXT,
  ADD COLUMN IF NOT EXISTS "pincode" TEXT,
  ADD COLUMN IF NOT EXISTS "graduationDocPath" TEXT,
  ADD COLUMN IF NOT EXISTS "graduationDocName" TEXT,
  ADD COLUMN IF NOT EXISTS "graduationDocMime" TEXT,
  ADD COLUMN IF NOT EXISTS "graduationDocSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "idDocPath" TEXT,
  ADD COLUMN IF NOT EXISTS "idDocName" TEXT,
  ADD COLUMN IF NOT EXISTS "idDocMime" TEXT,
  ADD COLUMN IF NOT EXISTS "idDocSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "razorpaySignature" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentAmountPaise" INTEGER,
  ADD COLUMN IF NOT EXISTS "discountPct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
  ADD COLUMN IF NOT EXISTS "gstRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gstAmountPaise" INTEGER,
  ADD COLUMN IF NOT EXISTS "taxableAmountPaise" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalAmountPaise" INTEGER,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_applications_razorpayOrderId_key"
  ON "partner_applications" ("razorpayOrderId")
  WHERE "razorpayOrderId" IS NOT NULL;
