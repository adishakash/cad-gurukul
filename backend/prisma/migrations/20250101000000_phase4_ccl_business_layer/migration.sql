-- Phase 4: CCL Business Layer — Joining Links, Attributed Sales, Commissions,
--           Payouts, Discount Config, and Training Content

-- CclJoiningLink: joining links created by a CCL to recruit candidates
CREATE TABLE "ccl_joining_links" (
    "id"             TEXT NOT NULL,
    "cclUserId"      TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "candidateName"  TEXT,
    "candidateEmail" TEXT,
    "candidatePhone" TEXT,
    "feeAmountPaise" INTEGER NOT NULL DEFAULT 1200000,
    "isUsed"         BOOLEAN NOT NULL DEFAULT false,
    "usedAt"         TIMESTAMP(3),
    "expiresAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_joining_links_pkey" PRIMARY KEY ("id")
);

-- CclAttributedSale: one record per sale attributed to a CCL
CREATE TABLE "ccl_attributed_sales" (
    "id"                  TEXT NOT NULL,
    "cclUserId"           TEXT NOT NULL,
    "joiningLinkId"       TEXT,
    "paymentId"           TEXT,
    "saleType"            TEXT NOT NULL,
    "grossAmountPaise"    INTEGER NOT NULL,
    "discountAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "netAmountPaise"      INTEGER NOT NULL,
    "commissionPaise"     INTEGER NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_attributed_sales_pkey" PRIMARY KEY ("id")
);

-- CclCommission: one commission entry per attributed sale
CREATE TABLE "ccl_commissions" (
    "id"               TEXT NOT NULL,
    "cclUserId"        TEXT NOT NULL,
    "attributedSaleId" TEXT NOT NULL,
    "amountPaise"      INTEGER NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'pending',
    "payoutId"         TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_commissions_pkey" PRIMARY KEY ("id")
);

-- CclPayout: weekly Thursday payout record, groups commissions
CREATE TABLE "ccl_payouts" (
    "id"           TEXT NOT NULL,
    "cclUserId"    TEXT NOT NULL,
    "amountPaise"  INTEGER NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "processedAt"  TIMESTAMP(3),
    "reference"    TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_payouts_pkey" PRIMARY KEY ("id")
);

-- CclDiscount: per-CCL discount configuration (0–20%)
CREATE TABLE "ccl_discounts" (
    "id"          TEXT NOT NULL,
    "cclUserId"   TEXT NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_discounts_pkey" PRIMARY KEY ("id")
);

-- CclTrainingContent: training material visible to CCL (admin-managed)
CREATE TABLE "ccl_training_content" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "url"          TEXT,
    "description"  TEXT,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccl_training_content_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "ccl_joining_links_code_key"             ON "ccl_joining_links"("code");
CREATE UNIQUE INDEX "ccl_attributed_sales_joiningLinkId_key" ON "ccl_attributed_sales"("joiningLinkId");
CREATE UNIQUE INDEX "ccl_attributed_sales_paymentId_key"     ON "ccl_attributed_sales"("paymentId");
CREATE UNIQUE INDEX "ccl_commissions_attributedSaleId_key"   ON "ccl_commissions"("attributedSaleId");
CREATE UNIQUE INDEX "ccl_discounts_cclUserId_key"            ON "ccl_discounts"("cclUserId");

-- Performance indexes
CREATE INDEX "ccl_joining_links_cclUserId_idx"    ON "ccl_joining_links"("cclUserId");
CREATE INDEX "ccl_joining_links_code_idx"         ON "ccl_joining_links"("code");
CREATE INDEX "ccl_attributed_sales_cclUserId_idx" ON "ccl_attributed_sales"("cclUserId");
CREATE INDEX "ccl_attributed_sales_status_idx"    ON "ccl_attributed_sales"("status");
CREATE INDEX "ccl_commissions_cclUserId_idx"      ON "ccl_commissions"("cclUserId");
CREATE INDEX "ccl_commissions_status_idx"         ON "ccl_commissions"("status");
CREATE INDEX "ccl_payouts_cclUserId_idx"          ON "ccl_payouts"("cclUserId");
CREATE INDEX "ccl_payouts_status_idx"             ON "ccl_payouts"("status");
CREATE INDEX "ccl_payouts_scheduledFor_idx"       ON "ccl_payouts"("scheduledFor");

-- Foreign keys — all reference users.id with CASCADE delete
ALTER TABLE "ccl_joining_links"
    ADD CONSTRAINT "ccl_joining_links_cclUserId_fkey"
    FOREIGN KEY ("cclUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ccl_attributed_sales"
    ADD CONSTRAINT "ccl_attributed_sales_cclUserId_fkey"
    FOREIGN KEY ("cclUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ccl_attributed_sales"
    ADD CONSTRAINT "ccl_attributed_sales_joiningLinkId_fkey"
    FOREIGN KEY ("joiningLinkId") REFERENCES "ccl_joining_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ccl_commissions"
    ADD CONSTRAINT "ccl_commissions_cclUserId_fkey"
    FOREIGN KEY ("cclUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ccl_commissions"
    ADD CONSTRAINT "ccl_commissions_attributedSaleId_fkey"
    FOREIGN KEY ("attributedSaleId") REFERENCES "ccl_attributed_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ccl_commissions"
    ADD CONSTRAINT "ccl_commissions_payoutId_fkey"
    FOREIGN KEY ("payoutId") REFERENCES "ccl_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ccl_payouts"
    ADD CONSTRAINT "ccl_payouts_cclUserId_fkey"
    FOREIGN KEY ("cclUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ccl_discounts"
    ADD CONSTRAINT "ccl_discounts_cclUserId_fkey"
    FOREIGN KEY ("cclUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
