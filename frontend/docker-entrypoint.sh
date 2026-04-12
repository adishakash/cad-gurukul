#!/bin/sh
# NOTE: This script is NOT executed by the current Dockerfile.
# The nginx:stable-alpine image uses its own /docker-entrypoint.sh which renders
# *.conf.template files from /etc/nginx/templates/ into /etc/nginx/conf.d/.
# The Dockerfile selects the correct template at build time via the NGINX_USE_PROXY arg.
#
# For DigitalOcean App Platform: the frontend is deployed as a static_sites component
# (no Docker/nginx at runtime). TLS is handled by the App Platform load balancer.
#
# This script is kept for reference only. To activate it, add:
#   ENTRYPOINT ["sh", "/docker-entrypoint.sh"]
# to the Dockerfile (replacing the nginx image's entrypoint).
set -eu

# Note: templates in the nginx image use the .conf.template suffix.
# Adjust these paths if you switch to a custom ENTRYPOINT approach.
HTTPS_CONF="/etc/nginx/templates/nginx.conf.template"
HTTP_CONF="/etc/nginx/templates/nginx.http.conf.template"
TARGET_CONF="/etc/nginx/conf.d/default.conf"
CERT_DIR="/etc/letsencrypt/live/cadgurukul.com"
FULLCHAIN="$CERT_DIR/fullchain.pem"
PRIVKEY="$CERT_DIR/privkey.pem"

if [ -f "$FULLCHAIN" ] && [ -f "$PRIVKEY" ]; then
    # Substitute env vars (primarily ${PORT}) before copying
    envsubst '${PORT}' < "$HTTPS_CONF" > "$TARGET_CONF"
    echo "Using HTTPS Nginx config (certificates found)."
else
    envsubst '${PORT}' < "$HTTP_CONF" > "$TARGET_CONF"
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
