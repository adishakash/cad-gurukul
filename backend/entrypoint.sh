#!/bin/sh
set -e

RUNTIME_DATABASE_URL="${DATABASE_POOL_URL:-${DATABASE_URL:-}}"
DIRECT_DATABASE_URL="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "${DIRECT_DATABASE_URL}" ]; then
	echo "DATABASE_URL or DATABASE_DIRECT_URL must be set before starting the API." >&2
	exit 1
fi

echo "▶ Running database migrations..."
DATABASE_URL="$DIRECT_DATABASE_URL" DATABASE_DIRECT_URL="$DIRECT_DATABASE_URL" node_modules/.bin/prisma migrate deploy

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
