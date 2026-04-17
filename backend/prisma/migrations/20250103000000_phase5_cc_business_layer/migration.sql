-- Phase 5: CC Business Layer — Test Links, Attributed Sales, Commissions,
--           Payouts, Discount Config, and targetRole extension for training content

-- CcTestLink: test links created by a CC to send to students/parents
CREATE TABLE "cc_test_links" (
    "id"                  TEXT NOT NULL,
    "ccUserId"            TEXT NOT NULL,
    "code"                TEXT NOT NULL,
    "planType"            TEXT NOT NULL DEFAULT 'standard',
    "candidateName"       TEXT,
    "candidateEmail"      TEXT,
    "candidatePhone"      TEXT,
    "feeAmountPaise"      INTEGER NOT NULL DEFAULT 49900,
    "isUsed"              BOOLEAN NOT NULL DEFAULT false,
    "usedAt"              TIMESTAMP(3),
    "expiresAt"           TIMESTAMP(3),
    "testOrderId"         TEXT,
    "testPaymentId"       TEXT,
    "testPaymentStatus"   TEXT NOT NULL DEFAULT 'pending',
    "testNetAmountPaise"  INTEGER,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_test_links_pkey" PRIMARY KEY ("id")
);

-- CcAttributedSale: one record per sale attributed to a CC
CREATE TABLE "cc_attributed_sales" (
    "id"                  TEXT NOT NULL,
    "ccUserId"            TEXT NOT NULL,
    "testLinkId"          TEXT,
    "paymentId"           TEXT NOT NULL,
    "saleType"            TEXT NOT NULL,
    "grossAmountPaise"    INTEGER NOT NULL,
    "discountAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "netAmountPaise"      INTEGER NOT NULL,
    "commissionPaise"     INTEGER NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_attributed_sales_pkey" PRIMARY KEY ("id")
);

-- CcCommission: one commission entry per attributed sale (70% of net)
CREATE TABLE "cc_commissions" (
    "id"               TEXT NOT NULL,
    "ccUserId"         TEXT NOT NULL,
    "attributedSaleId" TEXT NOT NULL,
    "amountPaise"      INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "payoutId"         TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_commissions_pkey" PRIMARY KEY ("id")
);

-- CcPayout: weekly Thursday payout record, groups commissions
CREATE TABLE "cc_payouts" (
    "id"           TEXT NOT NULL,
    "ccUserId"     TEXT NOT NULL,
    "amountPaise"  INTEGER NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "processedAt"  TIMESTAMP(3),
    "reference"    TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_payouts_pkey" PRIMARY KEY ("id")
);

-- CcDiscount: per-CC discount configuration (plan-aware caps)
CREATE TABLE "cc_discounts" (
    "id"          TEXT NOT NULL,
    "ccUserId"    TEXT NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "planType"    TEXT NOT NULL DEFAULT 'standard',
    "isActive"    BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cc_discounts_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "cc_test_links_code_key"             ON "cc_test_links"("code");
CREATE UNIQUE INDEX "cc_test_links_testOrderId_key"      ON "cc_test_links"("testOrderId") WHERE "testOrderId" IS NOT NULL;
CREATE UNIQUE INDEX "cc_attributed_sales_testLinkId_key" ON "cc_attributed_sales"("testLinkId") WHERE "testLinkId" IS NOT NULL;
CREATE UNIQUE INDEX "cc_attributed_sales_paymentId_key"  ON "cc_attributed_sales"("paymentId");
CREATE UNIQUE INDEX "cc_commissions_attributedSaleId_key" ON "cc_commissions"("attributedSaleId");
CREATE UNIQUE INDEX "cc_discounts_ccUserId_key"          ON "cc_discounts"("ccUserId");

-- Performance indexes
CREATE INDEX "cc_test_links_ccUserId_idx"      ON "cc_test_links"("ccUserId");
CREATE INDEX "cc_test_links_testOrderId_idx"   ON "cc_test_links"("testOrderId");
CREATE INDEX "cc_attributed_sales_ccUserId_idx" ON "cc_attributed_sales"("ccUserId");
CREATE INDEX "cc_attributed_sales_status_idx"  ON "cc_attributed_sales"("status");
CREATE INDEX "cc_commissions_ccUserId_idx"     ON "cc_commissions"("ccUserId");
CREATE INDEX "cc_commissions_status_idx"       ON "cc_commissions"("status");
CREATE INDEX "cc_payouts_ccUserId_idx"         ON "cc_payouts"("ccUserId");
CREATE INDEX "cc_payouts_status_idx"           ON "cc_payouts"("status");
CREATE INDEX "cc_payouts_scheduledFor_idx"     ON "cc_payouts"("scheduledFor");

-- Foreign keys
ALTER TABLE "cc_test_links"
    ADD CONSTRAINT "cc_test_links_ccUserId_fkey"
    FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cc_attributed_sales"
    ADD CONSTRAINT "cc_attributed_sales_ccUserId_fkey"
    FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cc_attributed_sales"
    ADD CONSTRAINT "cc_attributed_sales_testLinkId_fkey"
    FOREIGN KEY ("testLinkId") REFERENCES "cc_test_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cc_commissions"
    ADD CONSTRAINT "cc_commissions_ccUserId_fkey"
    FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cc_commissions"
    ADD CONSTRAINT "cc_commissions_attributedSaleId_fkey"
    FOREIGN KEY ("attributedSaleId") REFERENCES "cc_attributed_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cc_commissions"
    ADD CONSTRAINT "cc_commissions_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "cc_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cc_payouts"
    ADD CONSTRAINT "cc_payouts_ccUserId_fkey"
    FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cc_discounts"
    ADD CONSTRAINT "cc_discounts_ccUserId_fkey"
    FOREIGN KEY ("ccUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add targetRole column to ccl_training_content for shared training table
ALTER TABLE "ccl_training_content"
    ADD COLUMN "targetRole" TEXT NOT NULL DEFAULT 'CCL';
