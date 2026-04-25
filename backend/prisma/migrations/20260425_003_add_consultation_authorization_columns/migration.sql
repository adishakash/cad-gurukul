-- Add consultation authorization fields to users

ALTER TABLE "users" ADD COLUMN "isConsultationAuthorized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "consultationAuthorizedAt" TIMESTAMP(3);
