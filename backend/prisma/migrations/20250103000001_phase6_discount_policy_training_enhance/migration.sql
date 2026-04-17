-- Phase 6: Discount policies, inline discount on links, training file upload fields

-- DiscountPolicy table
CREATE TABLE "discount_policies" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "planType" TEXT NOT NULL,
  "minPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "discount_policies_role_planType_key" ON "discount_policies"("role", "planType");

-- Add inline discount field to CclJoiningLink
ALTER TABLE "ccl_joining_links" ADD COLUMN "discountPctUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add inline discount field to CcTestLink
ALTER TABLE "cc_test_links" ADD COLUMN "discountPctUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add file upload support fields to CclTrainingContent
ALTER TABLE "ccl_training_content" ADD COLUMN "originalFilename" TEXT;
ALTER TABLE "ccl_training_content" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "ccl_training_content" ADD COLUMN "isDownloadable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ccl_training_content" ADD COLUMN "mimeType" TEXT;
