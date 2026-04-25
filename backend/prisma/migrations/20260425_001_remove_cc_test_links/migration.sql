-- Remove legacy CC test links and related attribution fields

ALTER TABLE "cc_attributed_sales"
    DROP CONSTRAINT IF EXISTS "cc_attributed_sales_testLinkId_fkey";

DROP INDEX IF EXISTS "cc_attributed_sales_testLinkId_key";

ALTER TABLE "cc_attributed_sales"
    DROP COLUMN IF EXISTS "testLinkId";

DROP TABLE IF EXISTS "cc_test_links";
