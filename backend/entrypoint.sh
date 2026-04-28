#!/bin/sh
set -e

RUNTIME_DATABASE_URL="${DATABASE_POOL_URL:-${DATABASE_URL:-}}"
DIRECT_DATABASE_URL="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "${DIRECT_DATABASE_URL}" ]; then
	echo "DATABASE_URL or DATABASE_DIRECT_URL must be set before starting the API." >&2
	exit 1
fi

echo "▶ Running database migrations..."
if ! DATABASE_URL="$DIRECT_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node_modules/.bin/prisma migrate deploy; then
	echo "⚠ prisma migrate deploy failed. Checking for known recoverable migration state..."
	if DATABASE_URL="$DIRECT_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node_modules/.bin/prisma migrate resolve --rolled-back "20260428_fix_cc_standard_discount_policy"; then
		echo "▶ Retrying database migrations after resolving failed migration 20260428_fix_cc_standard_discount_policy..."
		DATABASE_URL="$DIRECT_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node_modules/.bin/prisma migrate deploy
	else
		echo "❌ Migration recovery failed. Manual intervention required." >&2
		exit 1
	fi
fi

if [ "${ENABLE_SCHEMA_HOTFIXES:-true}" = "true" ]; then
	echo "▶ Applying schema hotfixes (idempotent)..."
	DATABASE_URL="$DIRECT_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node scripts/ensure-consultation-schema.js

	if [ -n "${RUNTIME_DATABASE_URL}" ] && [ "${RUNTIME_DATABASE_URL}" != "${DIRECT_DATABASE_URL}" ]; then
		echo "▶ Applying schema hotfixes on runtime DB target..."
		DATABASE_URL="$RUNTIME_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node scripts/ensure-consultation-schema.js
	fi
fi

export DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL"
export DATABASE_URL="$RUNTIME_DATABASE_URL"

echo "▶ Starting CAD Gurukul API on port ${PORT:-5000}..."
exec node src/server.js
