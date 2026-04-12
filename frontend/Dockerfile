FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_RAZORPAY_KEY_ID
ARG VITE_APP_NAME

COPY package*.json ./
RUN npm install -g npm@11.12.1 && npm ci

COPY . .

RUN set -eu; \
	if [ -n "${VITE_API_BASE_URL:-}" ] || [ -n "${VITE_RAZORPAY_KEY_ID:-}" ] || [ -n "${VITE_APP_NAME:-}" ]; then \
		: > .env.production.local; \
		[ -n "${VITE_API_BASE_URL:-}" ] && echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" >> .env.production.local; \
		[ -n "${VITE_RAZORPAY_KEY_ID:-}" ] && echo "VITE_RAZORPAY_KEY_ID=${VITE_RAZORPAY_KEY_ID}" >> .env.production.local; \
		[ -n "${VITE_APP_NAME:-}" ] && echo "VITE_APP_NAME=${VITE_APP_NAME}" >> .env.production.local; \
	fi; \
	npm run build

# ─── Serve with Nginx ────────────────────────────────────────────
FROM nginx:stable-alpine

ARG NGINX_USE_PROXY=false

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/nginx.conf.template
COPY nginx.http.conf /etc/nginx/templates/nginx.http.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

ENV PORT=8080 \
	NGINX_USE_PROXY=${NGINX_USE_PROXY} \
	API_PROXY_TARGET=http://backend:5000 \
	API_BASE_URL=

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["sh", "/docker-entrypoint.sh"]
