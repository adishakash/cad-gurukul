FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Install ALL deps so prisma CLI (now in dependencies) is available for generate
RUN npm ci

COPY . .
RUN npx prisma generate
# Remove true devDependencies (nodemon, jest, eslint, supertest); prisma stays
RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

RUN mkdir -p logs uploads && chmod +x entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["sh", "entrypoint.sh"]
