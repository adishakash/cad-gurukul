#!/bin/sh
set -eu

HTTPS_CONF="/etc/nginx/templates/nginx.https.conf"
HTTP_CONF="/etc/nginx/templates/nginx.http.conf"
TARGET_CONF="/etc/nginx/conf.d/default.conf"
CERT_DIR="/etc/letsencrypt/live/cadgurukul.com"
FULLCHAIN="$CERT_DIR/fullchain.pem"
PRIVKEY="$CERT_DIR/privkey.pem"

if [ -f "$FULLCHAIN" ] && [ -f "$PRIVKEY" ]; then
    cp "$HTTPS_CONF" "$TARGET_CONF"
    echo "Using HTTPS Nginx config (certificates found)."
else
    cp "$HTTP_CONF" "$TARGET_CONF"
    echo "Using HTTP Nginx config (certificates not found)."
fi

# Periodically reload so updated certificates/config can be picked up.
(
    while :; do
        sleep "${NGINX_RELOAD_INTERVAL:-6h}" & wait $!
        nginx -s reload || true
    done
) &

exec nginx -g "daemon off;"
