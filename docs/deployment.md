# CAD Gurukul — Deployment Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (for containerised deploy)
- A Razorpay account (live/test key pair)
- OpenAI API key
- Google Gemini API key
- SMTP credentials (SendGrid / Mailtrap for dev)

---

## Option 1: Docker Compose (Recommended)

### 1. Clone & configure

```bash
git clone <repo>
cd webapp
cp backend/.env.example backend/.env
# Edit backend/.env — fill in all secrets
```

### 2. Set root-level env vars for compose

Create a `.env` at the project root:
```
POSTGRES_USER=cadgurukul
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=cadgurukul
VITE_API_BASE_URL=/api/v1
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

The bundled frontend nginx proxies `/api/*` to the backend container by default, so `/api/v1` is the correct same-origin setting for Docker Compose. Only use an absolute API URL if you are serving the backend from a different origin.

The frontend Docker image now supports a build arg `NGINX_USE_PROXY`:
- `true` (Docker Compose/local): enables `/api/* -> http://backend:5000` proxy
- `false` (DigitalOcean App Platform): disables internal proxy dependency

### 3. Build & launch

```bash
docker-compose up -d --build
```

### 4. Run migrations & seed

```bash
docker exec cadgurukul_backend npx prisma migrate deploy
docker exec cadgurukul_backend node prisma/seed.js
```

Default admin: `admin@cadgurukul.com` / `Admin@123456` — **change immediately.**

---

## Option 2: Manual (VPS / Railway / Render)

### Backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js
node src/server.js
```

Use PM2 for process management:
```bash
npm install -g pm2
pm2 start src/server.js --name cadgurukul-api
pm2 save
pm2 startup
```

### Frontend

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1 \
VITE_RAZORPAY_KEY_ID=rzp_live_xxx \
npm run build
# Serve dist/ via Nginx or static host (Vercel, Netlify)
```

---

## Option 3: DigitalOcean App Platform (Recommended for this repo)

This repository already includes a deploy spec at `.do/app.yaml` with:

- `api` as a Docker-based service from `backend/`
- `frontend` as a Docker-based Nginx service from `frontend/`
- managed PostgreSQL (`db`) wired to backend `DATABASE_URL`

### 1. Create app from spec

In DigitalOcean App Platform, choose **Create App** and import this repository.
App Platform will detect `.do/app.yaml` automatically.

### 2. Set real secret values

Replace all `CHANGE_ME_*` values in App Platform settings before first production deploy.

### 3. Confirm critical runtime variables

- Backend: `DATABASE_URL`, `DATABASE_DIRECT_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `RAZORPAY_*`, `SMTP_*`
- Backend CORS: `FRONTEND_URLS` includes `${frontend.PUBLIC_URL}` plus custom domains
- Frontend runtime: `API_BASE_URL=${api.PUBLIC_URL}/api/v1`
- Frontend build-time: `VITE_RAZORPAY_KEY_ID`, `VITE_APP_NAME`

The backend container now verifies a safe database write probe before it starts listening. If reads succeed but inserts hang, the deployment fails fast instead of looking healthy while public POST routes time out.

If you add a PostgreSQL connection pool later, keep Prisma migrations on the direct database URL and point runtime traffic at the pool:

```text
DATABASE_DIRECT_URL=${db.DATABASE_URL}
DATABASE_URL=${db.DATABASE_URL}
# Optional once a pool exists:
DATABASE_POOL_URL=${db.<pool-name>.DATABASE_URL}
```

If the frontend ever falls back to same-origin `${frontend.PUBLIC_URL}/api/v1/...` without an ingress rule that routes `/api` to the backend, App Platform will answer from the frontend host and POST requests will fail with `405 Not Allowed`. The checked-in spec avoids that by injecting `API_BASE_URL` into the frontend container at runtime.

- use an absolute backend URL such as `${api.PUBLIC_URL}/api/v1`, or
- run as a Docker service with explicit runtime `API_BASE_URL` injected into the container

### 4. Deploy and verify

- API health: `${api.PUBLIC_URL}/api/v1/health`
- Frontend app loads from `${frontend.PUBLIC_URL}`
- Register/login/payment/report flows work end-to-end

Recommended deployed API smoke test from `backend/` after each production deploy:

```bash
SMOKE_API_BASE_URL=${api.PUBLIC_URL}/api/v1 npm run smoke:api:deployed
```

After `ingress.rules` is live on the app/custom domain, verify same-domain routing with:

```bash
SMOKE_API_BASE_URL=https://cadgurukul.com/api/v1 \
SMOKE_FRONTEND_ORIGIN=https://cadgurukul.com \
npm run smoke:api:deployed
```

If you want one public domain to serve both the SPA and the API, use App Platform `ingress.rules` and test against the app/custom domain, not the component preview domain. A preview domain like `frontend-xxxx.ondigitalocean.app` always points directly to the frontend component and `/api/*` requests on that host will still return `405 Not Allowed`.

### Frontend service configuration in the checked-in spec

The repo spec now deploys `frontend/` with its `Dockerfile`. Keep `NGINX_USE_PROXY=false` and set runtime environment variables like this:

```text
NGINX_USE_PROXY=false
API_BASE_URL=https://<your-api-domain>/api/v1
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
VITE_APP_NAME=CAD Gurukul
```

Optional build args are still supported, but `API_BASE_URL` is the safer App Platform setting because it prevents shipping a stale baked-in API domain.

Only use `NGINX_USE_PROXY=true` when the frontend container should intentionally proxy `/api/*` itself, for example in local Docker Compose. In that mode, set `API_PROXY_TARGET` to the backend origin and keep `VITE_API_BASE_URL=/api/v1`.

---

## Environment Variables Checklist

### backend/.env

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Runtime PostgreSQL connection string (direct URL by default, or pool URL if you attach one) | ✅ |
| `DATABASE_DIRECT_URL` | Direct PostgreSQL connection string used for migrations and fail-safe startup | Recommended |
| `DATABASE_POOL_URL` | Optional PgBouncer / pooled runtime URL | Optional |
| `JWT_SECRET` | Random 64-char secret | ✅ |
| `JWT_REFRESH_SECRET` | Random 64-char secret | ✅ |
| `OPENAI_API_KEY` | GPT-4o key | ✅ |
| `GEMINI_API_KEY` | Gemini 1.5 Pro key | ✅ |
| `RAZORPAY_KEY_ID` | Razorpay key ID | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | ✅ |
| `SMTP_HOST` | SMTP host | ✅ |
| `SMTP_USER` | SMTP user | ✅ |
| `SMTP_PASS` | SMTP password | ✅ |
| `FRONTEND_URL` | Single fallback frontend origin for CORS | ✅ |
| `FRONTEND_URLS` | Comma-separated frontend origins for CORS allowlist | Recommended |
| `DB_WRITE_PROBE_TIMEOUT_MS` | Fail startup if the safe write probe does not complete in time | Recommended |

Example:
`FRONTEND_URLS=https://cadgurukul.com,https://www.cadgurukul.com,https://app.cadgurukul.com`

---

## Post-Deploy Checklist

- [ ] Change default admin password
- [ ] Verify Razorpay webhook endpoint (optional)
- [ ] Test a Free assessment end-to-end
- [ ] Test a Paid assessment + payment flow
- [ ] Confirm PDF download works
- [ ] Confirm welcome email is sent on register
- [ ] Configure custom domains in App Platform (TLS is managed by DigitalOcean)
- [ ] Set up database backups (pg_dump cron)
- [ ] Enable PM2 or systemd service restart on crash

---

## Nginx Reverse Proxy (if on VPS)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Monitoring & Logs

- Logs are written to `backend/logs/` (rotating daily)
- PM2: `pm2 logs cadgurukul-api`
- Docker: `docker logs cadgurukul_backend -f`
