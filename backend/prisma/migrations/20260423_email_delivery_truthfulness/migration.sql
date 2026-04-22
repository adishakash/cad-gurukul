ALTER TABLE "career_reports"
ADD COLUMN "reportEmailSentAt" TIMESTAMP(3),
ADD COLUMN "parentEmailSentAt" TIMESTAMP(3),
ADD COLUMN "emailDeliveryError" TEXT;

ALTER TABLE "consultation_bookings"
ADD COLUMN "schedulingEmailSentAt" TIMESTAMP(3),
ADD COLUMN "schedulingEmailError" TEXT,
ALTER COLUMN "status" SET DEFAULT 'booking_confirmed';

UPDATE "consultation_bookings"
SET "status" = 'booking_confirmed'
WHERE "status" = 'slot_mail_sent'
  AND "schedulingEmailSentAt" IS NULL;
