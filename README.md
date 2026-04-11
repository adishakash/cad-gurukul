# CAD Gurukul – AI-Powered Career Guidance SaaS for Indian Students

## Product Vision

CAD Gurukul is a production-grade SaaS platform that helps Indian students in Class 10, 11, and 12 discover the right career path, select the right stream, choose the right subjects, and plan their higher education journey — powered by adaptive AI assessment and personalized career guidance reports.

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
