set -eu

DEFAULT_CONF_TEMPLATE="/etc/nginx/templates/nginx.conf.template"
PROXY_CONF_TEMPLATE="/etc/nginx/templates/nginx.http.conf.template"
TARGET_CONF="/etc/nginx/conf.d/default.conf"
RUNTIME_CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

trim_whitespace() {
    printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

if [ "${NGINX_USE_PROXY:-false}" = "true" ]; then
    : "${API_PROXY_TARGET:?API_PROXY_TARGET must be set when NGINX_USE_PROXY=true}"
    envsubst '${PORT} ${API_PROXY_TARGET}' < "$PROXY_CONF_TEMPLATE" > "$TARGET_CONF"
else
    envsubst '${PORT}' < "$DEFAULT_CONF_TEMPLATE" > "$TARGET_CONF"
fi

NORMALIZED_API_BASE_URL="$(trim_whitespace "${API_BASE_URL:-}")"

if [ -n "$NORMALIZED_API_BASE_URL" ]; then
    API_BASE_URL_JSON="\"$(json_escape "$NORMALIZED_API_BASE_URL")\""
else
    API_BASE_URL_JSON='null'
fi

cat > "$RUNTIME_CONFIG_FILE" <<EOF
window.__CAD_GURUKUL_RUNTIME_CONFIG__ = {
  apiBaseUrl: ${API_BASE_URL_JSON}
}
EOF

exec nginx -g "daemon off;"
