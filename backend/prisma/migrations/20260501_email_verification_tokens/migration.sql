-- Migration: 20260501_email_verification_tokens
-- Adds EmailVerificationToken table for the email-verification signup gate.
-- User.isEmailVerified already exists (added in initial schema); no change needed there.

CREATE TABLE "email_verification_tokens" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "token"     TEXT        NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_key"
    ON "email_verification_tokens"("token");

CREATE INDEX "email_verification_tokens_userId_idx"
    ON "email_verification_tokens"("userId");

CREATE INDEX "email_verification_tokens_token_idx"
    ON "email_verification_tokens"("token");

ALTER TABLE "email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
