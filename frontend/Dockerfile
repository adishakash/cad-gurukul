FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@11.12.1 && npm ci

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_RAZORPAY_KEY_ID

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID

RUN npm run build

# ─── Serve with Nginx ────────────────────────────────────────────
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/nginx.https.conf
COPY nginx.http.conf /etc/nginx/templates/nginx.http.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
EXPOSE 443

CMD ["/docker-entrypoint.sh"]
