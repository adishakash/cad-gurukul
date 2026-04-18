-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260500_010_mvp_gaps
-- Phase MVP: Partner approval, bank accounts, settlement schedule,
--            commission adjustments, fraud flags, notification logs,
--            assessment personalization models, payout transfer fields
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE "AdjustmentType" AS ENUM ('REFUND_REVERSAL', 'PLATFORM_FEE', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'TAX_DEDUCTION');
CREATE TYPE "FraudFlagStatus" AS ENUM ('open', 'investigating', 'cleared', 'confirmed_fraud');
CREATE TYPE "NotificationChannel" AS ENUM ('whatsapp', 'email', 'sms');

-- User approval fields
ALTER TABLE "users" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- Partner Applications
CREATE TABLE "partner_applications" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "role"          "UserRole" NOT NULL,
    "status"        "ApplicationStatus" NOT NULL DEFAULT 'pending',
    "fullName"      TEXT NOT NULL,
    "phone"         TEXT NOT NULL,
    "city"          TEXT,
    "qualification" TEXT,
    "experience"    TEXT,
    "referredBy"    TEXT,
    "adminNotes"    TEXT,
    "reviewedBy"    TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "partner_applications_userId_key" ON "partner_applications"("userId");
CREATE INDEX "partner_applications_status_idx" ON "partner_applications"("status");
CREATE INDEX "partner_applications_role_idx" ON "partner_applications"("role");
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bank Accounts
CREATE TABLE "bank_accounts" (
    "id"                  TEXT NOT NULL,
    "userId"              TEXT NOT NULL,
    "accountHolder"       TEXT NOT NULL,
    "accountNumberEnc"    TEXT NOT NULL,
    "accountNumberLast4"  TEXT NOT NULL,
    "ifscCode"            TEXT NOT NULL,
    "bankName"            TEXT NOT NULL,
    "accountType"         TEXT NOT NULL DEFAULT 'savings',
    "isVerified"          BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt"          TIMESTAMP(3),
    "verifiedBy"          TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_accounts_userId_key" ON "bank_accounts"("userId");
CREATE INDEX "bank_accounts_userId_idx" ON "bank_accounts"("userId");
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Settlement Schedules
CREATE TABLE "settlement_schedules" (
    "id"          TEXT NOT NULL,
    "role"        TEXT NOT NULL,
    "dayOfWeek"   INTEGER NOT NULL DEFAULT 4,
    "isPaused"    BOOLEAN NOT NULL DEFAULT false,
    "pausedBy"    TEXT,
    "pausedAt"    TIMESTAMP(3),
    "pauseReason" TEXT,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "settlement_schedules_role_key" ON "settlement_schedules"("role");

-- Seed default schedule rows
INSERT INTO "settlement_schedules" ("id", "role", "dayOfWeek", "isPaused", "updatedAt", "createdAt")
VALUES
  (gen_random_uuid()::text, 'CC',  4, false, NOW(), NOW()),
  (gen_random_uuid()::text, 'CCL', 4, false, NOW(), NOW()),
  (gen_random_uuid()::text, 'ALL', 4, false, NOW(), NOW());

-- Commission Adjustments
CREATE TABLE "commission_adjustments" (
    "id"           TEXT NOT NULL,
    "role"         TEXT NOT NULL,
    "partnerId"    TEXT NOT NULL,
    "commissionId" TEXT,
    "type"         "AdjustmentType" NOT NULL,
    "amountPaise"  INTEGER NOT NULL,
    "reason"       TEXT NOT NULL,
    "createdBy"    TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commission_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commission_adjustments_partnerId_idx" ON "commission_adjustments"("partnerId");
CREATE INDEX "commission_adjustments_type_idx" ON "commission_adjustments"("type");
CREATE INDEX "commission_adjustments_createdAt_idx" ON "commission_adjustments"("createdAt");

-- Payout Fraud Flags
CREATE TABLE "payout_fraud_flags" (
    "id"         TEXT NOT NULL,
    "role"       TEXT NOT NULL,
    "partnerId"  TEXT NOT NULL,
    "payoutId"   TEXT,
    "reason"     TEXT NOT NULL,
    "status"     "FraudFlagStatus" NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payout_fraud_flags_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payout_fraud_flags_partnerId_idx" ON "payout_fraud_flags"("partnerId");
CREATE INDEX "payout_fraud_flags_status_idx" ON "payout_fraud_flags"("status");

-- Notification Logs
CREATE TABLE "notification_logs" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "channel"     "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "status"      "WhatsAppStatus" NOT NULL DEFAULT 'queued',
    "sentAt"      TIMESTAMP(3),
    "errorMsg"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_logs_userId_idx" ON "notification_logs"("userId");
CREATE INDEX "notification_logs_channel_idx" ON "notification_logs"("channel");
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- Assessment Profile Rules
CREATE TABLE "assessment_profile_rules" (
    "id"                 TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "classMin"           INTEGER,
    "classMax"           INTEGER,
    "ageMin"             INTEGER,
    "ageMax"             INTEGER,
    "boards"             TEXT[] DEFAULT ARRAY[]::TEXT[],
    "streams"            TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questionCount"      INTEGER NOT NULL DEFAULT 10,
    "isActive"           BOOLEAN NOT NULL DEFAULT true,
    "priority"           INTEGER NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assessment_profile_rules_pkey" PRIMARY KEY ("id")
);

-- Question Templates
CREATE TABLE "question_templates" (
    "id"           TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "category"     "QuestionCategory" NOT NULL,
    "options"      JSONB,
    "tags"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classMin"     INTEGER,
    "classMax"     INTEGER,
    "ageMin"       INTEGER,
    "ageMax"       INTEGER,
    "streams"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "usageCount"   INTEGER NOT NULL DEFAULT 0,
    "createdBy"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "question_templates_category_idx" ON "question_templates"("category");
CREATE INDEX "question_templates_isActive_idx" ON "question_templates"("isActive");

-- Extend CcPayout with transfer tracking fields
ALTER TABLE "cc_payouts" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cc_payouts" ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cc_payouts" ADD COLUMN "bankAccountSnapshot" JSONB;
ALTER TABLE "cc_payouts" ADD COLUMN "transferInitiatedAt" TIMESTAMP(3);
ALTER TABLE "cc_payouts" ADD COLUMN "transferRef" TEXT;

-- Extend CclPayout with transfer tracking fields
ALTER TABLE "ccl_payouts" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ccl_payouts" ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ccl_payouts" ADD COLUMN "bankAccountSnapshot" JSONB;
ALTER TABLE "ccl_payouts" ADD COLUMN "transferInitiatedAt" TIMESTAMP(3);
ALTER TABLE "ccl_payouts" ADD COLUMN "transferRef" TEXT;
