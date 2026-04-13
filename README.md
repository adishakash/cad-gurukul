# CAD Gurukul — AI-Powered Career Guidance SaaS

> Conversion-optimised funnel | Free → Paid target: 10%+  
> Last updated: April 2026

---

## Product Vision

CAD Gurukul helps Indian students in Class 8–12 discover the right career path, select the right stream, choose the right subjects, and plan their higher education journey — powered by adaptive AI assessment and personalised career guidance reports.

---

## Conversion Funnel

```
Home (hero CTA)
  ↓ "Start Free Career Test" — no login required
Assessment (guest mode: 3 static hook questions)
  ↓ After Q3 → inline LeadCaptureForm (name, phone, class — 3 fields)
  ↓ Lead created in DB + WhatsApp welcome sent
Register / Login
  ↓ leadId linked to user account
Assessment continues (AI adaptive — Q4–Q10)
  ↓
Free Report (teaser mode)
  — Top 3 careers shown
  — 4 more careers blurred/locked
  — Premium CTA shown immediately
  — WhatsApp re-engagement after 30 min if no upgrade
  ↓ "Unlock My Exact Career Path — ₹499"
Payment (Razorpay)
  ↓ Payment success → lead.status = paid
Premium Report (full AI report, PDF, roadmap)
  — WhatsApp delivery notification sent
Dashboard (conversion-focused)
  — Locked premium teaser if free report only
  — Strong upgrade CTA
```

### Key Metrics Targeted

| Metric                   | Before | Target |
|--------------------------|--------|--------|
| Assessment start rate    | ~20%   | 60%+   |
| Assessment completion    | ~40%   | 70%+   |
| Free → Paid conversion   | ~2–3%  | 10%+   |
| Payment completion       | ~60%   | 80%+   |

---

## Pricing Tiers (Value Ladder)

| Plan               | Price    | `planType`     | Notes                                    |
|--------------------|----------|----------------|------------------------------------------|
| Free Report        | ₹0       | `free`         | Top 3 careers, blurred premium teaser    |
| Full Report        | ₹499     | `standard`     | 7 careers, PDF, 3-year roadmap           |
| Premium AI Report  | ₹1,999   | `premium`      | GPT-4o priority, enhanced AI analysis   |
| 1:1 Counselling    | ₹9,999   | `consultation` | No assessment required, WA confirm sent  |

---

## Architecture

```
webapp/
├── backend/                    # Node.js 20 + Express API
│   ├── prisma/                 # Schema, migrations, seed
│   └── src/
│       ├── config/             # App & DB configuration
│       ├── controllers/        # Route handlers
│       ├── middleware/         # Auth, validation, rate limiting, logging
│       ├── routes/             # Express route definitions
│       ├── services/
│       │   ├── ai/             # OpenAI + Gemini orchestration
│       │   ├── analytics/      # Funnel tracking (fire-and-forget)
│       │   ├── automation/     # Event-driven WhatsApp + lead automation
│       │   ├── email/          # Nodemailer + SendGrid
│       │   ├── payment/        # Razorpay integration
│       │   ├── report/         # PDF generation (Puppeteer)
│       │   └── whatsapp/       # Provider-agnostic WhatsApp service
│       ├── utils/              # Helpers & Winston logger
│       └── validators/         # Joi validation schemas
├── frontend/                   # React 18 SPA (Vite)
│   └── src/
│       ├── components/         # LeadCaptureForm, PremiumUpsell, Layout
│       ├── pages/              # Route-level pages + Admin panel
│       ├── store/              # Redux Toolkit slices
│       └── services/           # Axios API client
└── docs/                       # API reference, ERD, deployment guide
```

---

## Tech Stack

| Layer       | Technology                                                         |
|-------------|--------------------------------------------------------------------|
| Frontend    | React 18, Redux Toolkit, React Router v6, Tailwind CSS, Recharts  |
| Backend     | Node.js 20, Express.js                                             |
| Database    | PostgreSQL 15                                                      |
| ORM         | Prisma 5                                                           |
| Auth        | JWT (access + refresh tokens)                                      |
| AI          | OpenAI GPT-4o + Google Gemini 1.5 Pro (orchestrated, fallback)    |
| Payments    | Razorpay (UPI, Cards, Net Banking)                                 |
| WhatsApp    | WATI / Interakt (provider-agnostic via `.env`; defaults to stub)  |
| PDF         | Puppeteer                                                          |
| Email       | Nodemailer + SendGrid                                              |
| Logging     | Winston                                                            |
| Validation  | Joi                                                                |
| Containers  | Docker + Docker Compose                                            |

---

## User Roles

| Role          | Description                                                        |
|---------------|--------------------------------------------------------------------|
| `STUDENT`     | Primary user — takes assessment, views/downloads report            |
| `PARENT`      | Linked to student — views report                                   |
| `COUNSELLOR`  | Future role — assigned to students for guidance                    |
| `ADMIN`       | Internal (separate JWT) — manages users, leads, analytics, pricing |

Admin sub-roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`.

---

## Key Features

### Free Plan
- No login needed to start — 3 hook questions shown immediately
- 10 adaptive AI questions after lead capture
- Free report: top 3 career matches + stream recommendation
- Blurred teaser of premium sections with locked-career count
- WhatsApp re-engagement after 30 min if no upgrade

### Paid Plan — ₹499 (standard)
- 30 adaptive AI questions
- Full report: 7 ranked career matches + confidence scores
- Aptitude radar chart
- Stream recommendation with detailed rationale
- Subject recommendations
- 3-year personalised career roadmap
- Top college suggestions
- Parent guidance section
- Downloadable PDF report (lifetime access)
- Instant WhatsApp delivery notification

### Admin Panel
- Lead pipeline view with funnel metric cards
- Paginated lead table with status filters and CSV export
- Lead detail page: event timeline, inline status editor, manual action buttons
- 30-day funnel metrics widget on dashboard
- Funnel summary and traffic source breakdown analytics

---

## WhatsApp Automation Events

| Event                    | Template                  | Trigger                                  |
|--------------------------|---------------------------|------------------------------------------|
| `lead_created`           | `cg_welcome`              | User fills lead form                     |
| `assessment_completed`   | `cg_assessment_done`      | Assessment finished                      |
| `free_report_ready`      | `cg_free_report_ready`    | Free report generated                    |
| `free_report_viewed`     | `cg_upgrade_nudge`        | User views free report (re-engagement)   |
| `payment_initiated`      | `cg_payment_reminder`     | Abandoned payment re-engagement          |
| `payment_success`        | `cg_payment_success`      | Payment confirmed                        |
| `premium_report_ready`   | `cg_premium_report_ready` | Premium report delivered                 |
| `assessment_abandoned`   | `cg_resume_assessment`    | Incomplete assessment follow-up          |
| `premium_ai_purchased`   | `cg_premium_ai_upsell`    | ₹1,999 premium AI plan purchased         |
| `consultation_booked`    | `cg_consultation_confirm` | ₹9,999 counselling session booked        |

> `automationService` never throws — safe to call from any controller without try/catch.

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in .env values (see Environment Variables below)
npx prisma migrate dev --name init
npx prisma generate
node prisma/seed.js      # optional: seed sample data
npm run dev
```

### Frontend
```bash
cd frontend
npm install
# Create frontend/.env with VITE_API_BASE_URL=http://localhost:5000/api/v1
npm run dev
```

### Frontend Smoke Test
```bash
# Start the frontend locally in one terminal
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173

# Run the guest funnel smoke test from the backend directory
cd ../backend
npm run smoke:frontend

# Optional: target a different frontend URL
SMOKE_BASE_URL=http://127.0.0.1:4173 npm run smoke:frontend
```

### Deployed Frontend Smoke Test
```bash
# Production-safe smoke test against the live frontend.
# This only checks navigation, guest assessment steps, and auth handoff links.
cd backend
npm run smoke:frontend:deployed

# Target a staging or preview frontend instead of production
SMOKE_DEPLOYED_BASE_URL=https://staging.cadgurukul.com npm run smoke:frontend:deployed
```

PowerShell examples:
```powershell
cd backend
$env:SMOKE_BASE_URL = 'http://127.0.0.1:4173'
npm run smoke:frontend

$env:SMOKE_DEPLOYED_BASE_URL = 'https://staging.cadgurukul.com'
npm run smoke:frontend:deployed
```

### Deployed API Smoke Test
```bash
# End-to-end API smoke test against a live backend or app domain.
# This checks health, CORS preflight, validation, register, login, refresh, and logout.
cd backend
SMOKE_API_BASE_URL=https://backend-vsrii.ondigitalocean.app/api/v1 npm run smoke:api:deployed

# Test the app/custom domain after App Platform ingress rules are live
SMOKE_API_BASE_URL=https://cadgurukul.com/api/v1 \
SMOKE_FRONTEND_ORIGIN=https://cadgurukul.com \
npm run smoke:api:deployed

# Skip the side-effectful auth create/login flow if you only want routing and validation checks
SMOKE_AUTH_FLOW=false npm run smoke:api:deployed
```

PowerShell examples:
```powershell
cd backend
$env:SMOKE_API_BASE_URL = 'https://backend-vsrii.ondigitalocean.app/api/v1'
$env:SMOKE_FRONTEND_ORIGIN = 'https://frontend-jyvsf.ondigitalocean.app'
npm run smoke:api:deployed

$env:SMOKE_API_BASE_URL = 'https://cadgurukul.com/api/v1'
$env:SMOKE_FRONTEND_ORIGIN = 'https://cadgurukul.com'
npm run smoke:api:deployed
```

### Docker Compose (recommended for full-stack local)
```bash
# 1. Configure backend secrets
cp backend/.env.example backend/.env
# Edit backend/.env

# 2. Create root .env
cat > .env <<EOF
POSTGRES_USER=cadgurukul
POSTGRES_PASSWORD=changeme
POSTGRES_DB=cadgurukul
VITE_API_BASE_URL=/api/v1
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
EOF

# 3. Build & start
docker-compose up -d --build

# 4. Run migrations
docker exec cadgurukul_backend npx prisma migrate deploy
docker exec cadgurukul_backend node prisma/seed.js
```

App available at `http://localhost` (frontend) and `http://localhost:5000` (API).
Keep `VITE_API_BASE_URL=/api/v1` only when the deployed frontend host proxies `/api` to the backend. For App Platform or any split frontend/backend deploy, use the backend's absolute `/api/v1` URL instead.
For the Docker-based App Platform frontend in `.do/app.yaml`, prefer runtime `API_BASE_URL=${api.PUBLIC_URL}/api/v1` with `NGINX_USE_PROXY=false` so preview and custom-domain deploys do not ship a stale baked-in API host.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable               | Description                                          |
|------------------------|------------------------------------------------------|
| `DATABASE_URL`         | Runtime PostgreSQL connection string                 |
| `DATABASE_DIRECT_URL`  | Direct PostgreSQL URL for migrations / fail-safe startup |
| `DATABASE_POOL_URL`    | Optional pooled PostgreSQL URL for runtime traffic   |
| `JWT_SECRET`           | JWT signing secret                                   |
| `JWT_REFRESH_SECRET`   | Refresh token signing secret                         |
| `PORT`                 | API port (default: `5000`)                           |
| `NODE_ENV`             | `development` or `production`                        |
| `OPENAI_API_KEY`       | OpenAI API key                                       |
| `GEMINI_API_KEY`       | Google Gemini API key                                |
| `RAZORPAY_KEY_ID`      | Razorpay key ID                                      |
| `RAZORPAY_KEY_SECRET`  | Razorpay key secret                                  |
| `SMTP_HOST`            | SMTP host (e.g. `smtp.sendgrid.net`)                 |
| `SMTP_PORT`            | SMTP port                                            |
| `SMTP_USER`            | SMTP username                                        |
| `SMTP_PASS`            | SMTP password / API key                              |
| `WHATSAPP_PROVIDER`    | `wati` / `interakt` / `stub` (default: `stub`)      |
| `WHATSAPP_API_URL`     | WhatsApp provider API base URL                       |
| `WHATSAPP_API_TOKEN`   | WhatsApp bearer token                                |
| `DB_WRITE_PROBE_TIMEOUT_MS` | Startup write-probe timeout in milliseconds     |

### Frontend (`frontend/.env`)

| Variable               | Description                               |
|------------------------|-------------------------------------------|
| `VITE_API_BASE_URL`    | API base URL (`/api/v1` only behind a proxy, otherwise absolute) |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable key                  |
| `API_BASE_URL`         | Runtime API base URL for the Docker/App Platform frontend |
| `NGINX_USE_PROXY`      | `true` only when the frontend should proxy `/api/*` itself |

---

## Database Schema (Key Models)

| Model              | Purpose                                                      |
|--------------------|--------------------------------------------------------------|
| `User`             | Email/password auth, role (`STUDENT` / `PARENT` / `COUNSELLOR`) |
| `StudentProfile`   | Class, board, subjects, parent details                       |
| `Assessment`       | Adaptive question session per student, status tracking       |
| `AssessmentResponse` | Per-question answers (MCQ, rating, text, ranking, yes/no) |
| `CareerReport`     | AI-generated report, PDF URL, `reportType` (free/paid)      |
| `Payment`          | Razorpay order/payment IDs, status lifecycle                 |
| `Lead`             | Email-deduped, `planType`, `qualificationScore`, UTM data   |
| `LeadEvent`        | Append-only event timeline per lead                          |
| `WhatsappMessage`  | Outbound message log (provider-agnostic)                     |
| `AutomationJob`    | Async job queue records                                      |
| `AnalyticsEvent`   | Fire-and-forget funnel event log                             |
| `Admin`            | Separate auth table with sub-roles                           |

---

## API Reference

Base URL: `/api/v1`

| Prefix       | Description                           |
|--------------|---------------------------------------|
| `/auth`      | Register, login, refresh, logout      |
| `/assessment`| Start, submit answers, get status     |
| `/report`    | Get free/paid report, download PDF    |
| `/payment`   | Create order, verify payment          |
| `/leads`     | Lead capture, link user               |
| `/student`   | Profile CRUD                          |
| `/admin`     | Dashboard, leads, funnel stats        |

Full reference: [docs/api.md](./docs/api.md)

---

## Lead → User Linking Flow

1. Guest fills `LeadCaptureForm` → `cg_lead_id` saved to `localStorage` + `?leadId=` appended to `/register` URL
2. After `registerUser()` succeeds → `leadApi.linkUser(leadId)` called silently → `localStorage` cleared

---

## Documentation

- [API Reference](./docs/api.md)
- [Database ERD](./docs/erd.md)
- [Deployment Guide](./docs/deployment.md)

---

## Funnel Optimisations (April 2026)

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | Auth-gate before any question | `/assessment` is now a public route; guests see 3 questions with zero friction |
| 2 | Lead form had 7+ fields on first touch | `midAssessment` mode: 3 fields only (name, phone, class) |
| 3 | No urgency on free report | Locked career teaser (blurred), urgent banner, immediate inline premium CTA |
| 4 | `PremiumUpsell` shown after 3-second delay | Shown inline immediately |
| 5 | Home CTA opened a form | Now navigates directly to `/assessment` — value before data |
| 6 | Dashboard blocked assessment behind profile completion | Restriction removed |
| 7 | Lead dedup by email only | Added phone-based dedup for mid-assessment temp-email leads |
| 8 | Missing WhatsApp triggers | Added `free_report_viewed` (upgrade nudge) + `payment_initiated` (abandoned payment) |
| 9 | Onboarding required before assessment | Soft warning instead of hard block |
