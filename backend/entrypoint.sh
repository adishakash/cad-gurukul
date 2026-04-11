#!/bin/sh
set -e

echo "▶ Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "▶ Starting CAD Gurukul API on port ${PORT:-5000}..."
exec node src/server.js
