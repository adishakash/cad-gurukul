'use strict';

const prisma = require('../config/database');
const logger = require('./logger');

const REQUIRED_COLUMNS = [
  { table: 'partner_applications', column: 'addressLine' },
  { table: 'partner_applications', column: 'pincode' },
];

const schemaName = () => process.env.DB_SCHEMA || 'public';

async function columnExists({ table, column }) {
  const rows = await prisma.$queryRaw`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = ${schemaName()}
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function verifyStartupSchema() {
  const missing = [];

  for (const item of REQUIRED_COLUMNS) {
    // Sequential checks keep startup logs deterministic and easier to read.
    // eslint-disable-next-line no-await-in-loop
    const ok = await columnExists(item);
    if (!ok) missing.push(item);
  }

  if (!missing.length) return;

  const missingList = missing.map((m) => `${m.table}.${m.column}`).join(', ');
  const message = `[StartupSchemaGuard] Missing required DB columns: ${missingList}`;
  const hint = 'Run: npx prisma migrate deploy (migration 20260517_002_partner_application_address_fields).';
  const failFast = process.env.STARTUP_SCHEMA_GUARD_STRICT === 'true';

  if (failFast) {
    throw new Error(`${message}. ${hint}`);
  }

  logger.error(message, { hint, strict: failFast, schema: schemaName() });
}

module.exports = {
  verifyStartupSchema,
};
