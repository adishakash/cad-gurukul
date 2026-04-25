-- Sync CC business layer tables with current Prisma schema

-- Ensure cc_coupons exists
CREATE TABLE IF NOT EXISTS "cc_coupons" (
    "id"             TEXT NOT NULL,
    "ccUserId"       TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "planType"       TEXT NOT NULL,
    "discountPct"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "usageCount"     INTEGER NOT NULL DEFAULT 0,
    "maxRedemptions" INTEGER,
    "expiresAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cc_coupons_pkey" PRIMARY KEY ("id")
);

-- Ensure cc_coupons columns exist (for older partial schemas)
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "ccUserId"       TEXT NOT NULL;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "code"           TEXT NOT NULL;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "planType"       TEXT NOT NULL;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "discountPct"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "isActive"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "usageCount"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "maxRedemptions" INTEGER;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "expiresAt"      TIMESTAMP(3);
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "cc_coupons" ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Indexes for cc_coupons
CREATE UNIQUE INDEX IF NOT EXISTS "cc_coupons_code_key" ON "cc_coupons"("code");
CREATE INDEX IF NOT EXISTS "cc_coupons_ccUserId_idx" ON "cc_coupons"("ccUserId");
CREATE INDEX IF NOT EXISTS "cc_coupons_planType_idx" ON "cc_coupons"("planType");
CREATE INDEX IF NOT EXISTS "cc_coupons_isActive_idx" ON "cc_coupons"("isActive");

-- FK: cc_coupons.ccUserId -> users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cc_coupons_ccUserId_fkey'
  ) THEN
    ALTER TABLE "cc_coupons"
      ADD CONSTRAINT "cc_coupons_ccUserId_fkey"
      FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing fields to cc_attributed_sales
ALTER TABLE "cc_attributed_sales" ADD COLUMN IF NOT EXISTS "planType" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "cc_attributed_sales" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.7;
ALTER TABLE "cc_attributed_sales" ADD COLUMN IF NOT EXISTS "ccCouponId" TEXT;
ALTER TABLE "cc_attributed_sales" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;

CREATE INDEX IF NOT EXISTS "cc_attributed_sales_ccCouponId_idx" ON "cc_attributed_sales"("ccCouponId");

-- FK: cc_attributed_sales.ccCouponId -> cc_coupons.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cc_attributed_sales_ccCouponId_fkey'
  ) THEN
    ALTER TABLE "cc_attributed_sales"
      ADD CONSTRAINT "cc_attributed_sales_ccCouponId_fkey"
      FOREIGN KEY ("ccCouponId") REFERENCES "cc_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add missing fields to cc_payouts
ALTER TABLE "cc_payouts" ADD COLUMN IF NOT EXISTS "failureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cc_payouts" ADD COLUMN IF NOT EXISTS "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cc_payouts" ADD COLUMN IF NOT EXISTS "bankAccountSnapshot" JSONB;
ALTER TABLE "cc_payouts" ADD COLUMN IF NOT EXISTS "transferInitiatedAt" TIMESTAMP(3);
ALTER TABLE "cc_payouts" ADD COLUMN IF NOT EXISTS "transferRef" TEXT;

-- Ensure discount_policies soft-delete columns exist
ALTER TABLE "discount_policies" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "discount_policies" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
CREATE INDEX IF NOT EXISTS "discount_policies_deletedAt_idx" ON "discount_policies"("deletedAt");

-- Ensure training content targetRole exists for CC training
ALTER TABLE "ccl_training_content" ADD COLUMN IF NOT EXISTS "targetRole" TEXT NOT NULL DEFAULT 'CCL';
