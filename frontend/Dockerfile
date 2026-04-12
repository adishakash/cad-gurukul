FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_RAZORPAY_KEY_ID=
ARG VITE_APP_NAME=CAD Gurukul

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID
ENV VITE_APP_NAME=$VITE_APP_NAME

COPY package*.json ./
RUN npm install -g npm@11.12.1 && npm ci

COPY . .

RUN npm run build

# ─── Serve with Nginx ────────────────────────────────────────────
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.http.conf /etc/nginx/templates/default.conf.template

ENV PORT=8080

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
