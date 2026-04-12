# CAD Gurukul – AI-Powered Career Guidance SaaS for Indian Students

> **Conversion-optimised funnel** — Free → Paid target: 10%+  
> Last updated: April 2026

## Product Vision

CAD Gurukul is a production-grade SaaS platform that helps Indian students in Class 8–12 discover the right career path, select the right stream, choose the right subjects, and plan their higher education journey — powered by adaptive AI assessment and personalised career guidance reports.

---

## Conversion Funnel Overview

```
Home (hero CTA)
  ↓ "Start Free Career Test" — no login needed
Assessment (guest mode: 3 static hook questions)
  ↓ After Q3 → inline LeadCaptureForm (name, phone, class — 3 fields only)
  ↓ Lead created in DB + WhatsApp welcome sent
Register / Login
  ↓ (leadId linked to user account)
Assessment continues (AI adaptive — Q4–Q10)
  ↓
Free Report (teaser mode)
  — Top 3 careers shown
  — 🔐 4 more careers blurred/locked
  — Premium CTA visible immediately (no 3s delay)
  — WhatsApp re-engagement sent after 30 min if no upgrade
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

| Metric | Before | Target |
|--------|--------|--------|
| Assessment start rate | ~20% | 60%+ |
| Assessment completion | ~40% | 70%+ |
| Free → Paid conversion | ~2–3% | 10%+ |
| Payment completion | ~60% | 80%+ |

---

## Architecture Overview

```
webapp/
├── backend/                  # Node.js + Express API
│   ├── prisma/               # Database schema & migrations
│   └── src/
│       ├── config/           # App & DB configs
│       ├── controllers/      # Route handlers
│       ├── middleware/        # Auth, validation, rate limiting
│       ├── routes/           # Express route definitions
│       ├── services/         # Business logic
│       │   ├── ai/           # OpenAI + Gemini orchestration
│       │   ├── automation/   # Event-driven WhatsApp + lead automation
│       │   ├── payment/      # Razorpay integration
│       │   ├── report/       # PDF report generation
│       │   └── whatsapp/     # Provider-agnostic WhatsApp service
│       ├── utils/            # Helpers & logger
│       └── validators/       # Joi validation schemas
├── frontend/                 # React.js SPA
│   └── src/
│       ├── components/       # LeadCaptureForm, PremiumUpsell, Layout
│       ├── pages/            # Route-level pages
│       ├── store/            # Redux Toolkit state
│       └── services/         # API client layer
└── docs/                     # Architecture & API docs
```

---

## Tech Stack

| Layer        | Technology                                                     |
|-------------|----------------------------------------------------------------|
| Frontend    | React 18, Redux Toolkit, React Router v6, Tailwind CSS         |
| Backend     | Node.js 20, Express.js                                         |
| Database    | PostgreSQL 15                                                  |
| ORM         | Prisma                                                         |
| Auth        | JWT (access + refresh tokens)                                  |
| AI          | OpenAI GPT-4o + Google Gemini 1.5 Pro (orchestrated)          |
| Payments    | Razorpay (UPI, Cards, Net Banking)                             |
| WhatsApp    | WATI / Interakt (provider-agnostic, configure via `.env`)      |
| PDF         | Puppeteer                                                      |
| Email       | Nodemailer + SendGrid                                          |
| Logging     | Winston                                                        |
| Validation  | Joi                                                            |

---

## User Roles

1. **Student** – Primary user; takes assessment, views/downloads report
2. **Parent** – Secondary; linked to student; views report
3. **Admin** – Internal; manages users, reports, pricing, analytics
4. **Counsellor** – Future role; assigned to students for guidance

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in .env values
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

---

## Environment Variables (see `backend/.env.example`)

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – JWT signing secret
- `OPENAI_API_KEY` – OpenAI API key
- `GEMINI_API_KEY` – Google Gemini API key
- `RAZORPAY_KEY_ID` – Razorpay key ID
- `RAZORPAY_KEY_SECRET` – Razorpay key secret
- `SMTP_*` – Email service credentials
- `WHATSAPP_PROVIDER` – `wati` | `interakt` | `stub` (default: stub)
- `WHATSAPP_API_URL` – WhatsApp provider API base URL
- `WHATSAPP_API_TOKEN` – Bearer token for WhatsApp provider

---

## Key Features

### Free Plan
- **No login needed to start** — 3 hook questions shown immediately
- 10 adaptive AI questions after lead capture
- Free report: top 3 career matches + stream recommendation
- Locked teaser of premium sections (blurred UI)
- WhatsApp re-engagement after 30 min if no upgrade

### Paid Plan – ₹499 (one-time)
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

---

## WhatsApp Automation Events

| Event | Template | Trigger |
|-------|----------|---------|
| `lead_created` | `cg_welcome` | User fills lead form |
| `assessment_completed` | `cg_assessment_done` | Assessment finished |
| `free_report_ready` | `cg_free_report_ready` | Free report generated |
| `free_report_viewed` | `cg_upgrade_nudge` | User views free report (re-engagement) |
| `payment_initiated` | `cg_payment_reminder` | Abandoned payment re-engagement |
| `payment_success` | `cg_payment_success` | Payment confirmed |
| `premium_report_ready` | `cg_premium_report_ready` | Premium report delivered |
| `assessment_abandoned` | `cg_resume_assessment` | Incomplete assessment follow-up |

---

## Funnel Optimisation Changes (April 2026)

### Diagnosis — Issues Fixed

1. **Auth-gate before ANY question** → Removed. `/assessment` is now a public route. Guests see 3 hook questions with zero friction.
2. **LeadCaptureForm with 7+ fields on first touch** → Added `midAssessment` mode: 3 fields only (name, phone, class).
3. **No urgency on free report** → Added: locked career teaser (blurred), urgent banner, immediate inline premium CTA.
4. **PremiumUpsell shown after 3-second delay** → Shown inline immediately.
5. **Home CTA opened a form** → Now navigates directly to `/assessment` — users experience value before giving data.
6. **Dashboard blocked assessment behind profile completion** → Restriction removed; assessment is accessible directly.
7. **Lead dedup by email only** → Added phone-based dedup to catch mid-assessment temp-email leads.
8. **Missing WhatsApp triggers** → Added `free_report_viewed` (upgrade nudge) and `payment_initiated` (abandoned payment) to automation map.
9. **Onboarding required before assessment** → Backend now allows assessment start with partial profile (soft warning instead of hard block).

### Files Changed

**Frontend:**
- `src/App.jsx` — moved `/assessment` to public route
- `src/pages/Home.jsx` — urgency hero copy, CTA → `/assessment`
- `src/pages/Assessment.jsx` — guest mode (3 questions + inline lead capture + motivational progress text)
- `src/components/LeadCaptureForm.jsx` — `midAssessment` prop (3-field simplified mode)
- `src/pages/Report.jsx` — lock banner, blurred career teaser, immediate premium CTA
- `src/components/PremiumUpsell.jsx` — emotional Indian copy, urgency scarcity
- `src/pages/Dashboard.jsx` — removed assessment block, premium teaser upgrade card

**Backend:**
- `src/controllers/assessment.controller.js` — relaxed onboarding requirement
- `src/controllers/lead.controller.js` — phone-based dedup
- `src/controllers/report.controller.js` — `free_report_viewed` automation trigger, richer lock CTA messages
- `src/services/automation/automationService.js` — `free_report_viewed` + `payment_initiated` WhatsApp triggers

---

## API Base URL

`/api/v1`

## Documentation

- [API Reference](./docs/api.md)
- [Database ERD](./docs/erd.md)
- [Deployment Guide](./docs/deployment.md)


---

## Architecture Overview

```
webapp/
├── backend/                  # Node.js + Express API
│   ├── prisma/               # Database schema & migrations
│   └── src/
│       ├── config/           # App & DB configs
│       ├── controllers/      # Route handlers
│       ├── middleware/       # Auth, validation, rate limiting
│       ├── routes/           # Express route definitions
│       ├── services/         # Business logic
│       │   ├── ai/           # OpenAI + Gemini orchestration
│       │   ├── payment/      # Razorpay integration
│       │   ├── report/       # PDF report generation
│       │   └── email/        # Email notifications
│       ├── utils/            # Helpers & logger
│       └── validators/       # Joi validation schemas
├── frontend/                 # React.js SPA
│   └── src/
│       ├── assets/           # Images, fonts, icons
│       ├── components/       # Reusable UI components
│       ├── pages/            # Route-level pages
│       ├── store/            # Redux Toolkit state
│       ├── services/         # API client layer
│       ├── hooks/            # Custom React hooks
│       └── utils/            # Frontend utilities
└── docs/                     # Architecture & API docs
```

---

## Tech Stack

| Layer        | Technology               |
|-------------|--------------------------|
| Frontend    | React 18, Redux Toolkit, React Router v6, Tailwind CSS |
| Backend     | Node.js 20, Express.js   |
| Database    | PostgreSQL 15            |
| ORM         | Prisma                   |
| Auth        | JWT (access + refresh tokens) |
| AI          | OpenAI GPT-4o + Google Gemini 1.5 Pro |
| Payments    | Razorpay                 |
| PDF         | Puppeteer                |
| Email       | Nodemailer + SendGrid    |
| Logging     | Winston                  |
| Validation  | Joi                      |

---

## User Roles

1. **Student** – Primary user; registers, takes assessment, views/downloads report
2. **Parent** – Secondary; linked to student; views report
3. **Admin** – Internal; manages users, reports, pricing, analytics
4. **Counsellor** – Future role; assigned to students for guidance

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in .env values
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm start
```

---

## Environment Variables (see backend/.env.example)

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – JWT signing secret
- `OPENAI_API_KEY` – OpenAI API key
- `GEMINI_API_KEY` – Google Gemini API key
- `RAZORPAY_KEY_ID` – Razorpay key ID
- `RAZORPAY_KEY_SECRET` – Razorpay key secret
- `SMTP_*` – Email service credentials

---

## Key Features

### Free Plan
- Basic student profile
- 10 adaptive questions
- Limited summary report
- Stream recommendation only
- Soft CTA to upgrade

### Paid Plan – ₹499/-
- Full 30+ question adaptive assessment
- Comprehensive AI-generated report
- Stream + subject + career recommendations
- 1-year and 3-year roadmaps
- Parent guidance notes
- Downloadable PDF report
- Priority AI model (GPT-4o)

---

## API Base URL

`/api/v1`

## Documentation

- [API Reference](./docs/api.md)
- [Database ERD](./docs/erd.md)
- [AI Prompting Layer](./docs/ai-prompts.md)
- [Deployment Guide](./docs/deployment.md)
