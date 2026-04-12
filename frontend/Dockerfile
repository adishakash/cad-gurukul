FROM node:20-alpine AS builder

WORKDIR /app

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
