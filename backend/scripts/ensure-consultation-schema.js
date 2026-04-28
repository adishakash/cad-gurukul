'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const applyHotfix = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "consultation_bookings"
    ADD COLUMN IF NOT EXISTS "counsellorUserId" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "consultation_bookings_counsellorUserId_idx"
    ON "consultation_bookings"("counsellorUserId");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'consultation_bookings_counsellorUserId_fkey'
      ) THEN
        ALTER TABLE "consultation_bookings"
          ADD CONSTRAINT "consultation_bookings_counsellorUserId_fkey"
          FOREIGN KEY ("counsellorUserId")
          REFERENCES "users"("id")
          ON DELETE SET NULL
          ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const run = async () => {
  try {
    await applyHotfix();
    console.log('[SchemaHotfix] consultation_bookings.counsellorUserId verified');
  } catch (error) {
    console.error('[SchemaHotfix] failed to apply consultation schema hotfix:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

run();
