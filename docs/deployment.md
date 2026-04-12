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
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

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
- `frontend` as a static site from `frontend/`
- managed PostgreSQL (`db`) wired to backend `DATABASE_URL`

### 1. Create app from spec

In DigitalOcean App Platform, choose **Create App** and import this repository.
App Platform will detect `.do/app.yaml` automatically.

### 2. Set real secret values

Replace all `CHANGE_ME_*` values in App Platform settings before first production deploy.

### 3. Confirm critical runtime variables

- Backend: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `RAZORPAY_*`, `SMTP_*`
- Backend CORS: `FRONTEND_URLS` includes `${frontend.PUBLIC_URL}` plus custom domains
- Frontend build-time: `VITE_API_BASE_URL=${api.PUBLIC_URL}/api/v1`

### 4. Deploy and verify

- API health: `${api.PUBLIC_URL}/api/v1/health`
- Frontend app loads from `${frontend.PUBLIC_URL}`
- Register/login/payment/report flows work end-to-end

---

## Environment Variables Checklist

### backend/.env

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Random 64-char secret | ✅ |
| `JWT_REFRESH_SECRET` | Random 64-char secret | ✅ |
| `OPENAI_API_KEY` | GPT-4o key | ✅ |
| `GEMINI_API_KEY` | Gemini 1.5 Pro key | ✅ |
| `RAZORPAY_KEY_ID` | Razorpay key ID | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | ✅ |
| `SMTP_HOST` | SMTP host | ✅ |
| `SMTP_USER` | SMTP user | ✅ |
| `SMTP_PASS` | SMTP password | ✅ |
| `FRONTEND_URL` | Frontend origin (CORS) | ✅ |

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
