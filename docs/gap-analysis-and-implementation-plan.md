# CAD Gurukul — Complete Gap Analysis & Implementation Plan
> Generated: April 2026 | Author: Senior Full-Stack Architect Review
> Source of truth: README.md + live codebase audit

---

## 1. Current Feature Audit

### Status Definitions
- **EXISTING** — Fully implemented in backend + frontend
- **PARTIAL** — Backend or schema exists; frontend or key sub-flow missing
- **MISSING** — Not in schema, backend, or frontend
- **NOT CONFIRMED** — README/code is ambiguous; needs verification

Note: CC test links are retired. CCs use a single referral link plus coupon codes.

---

### A. Admin Capabilities

| Requirement | Status | Notes |
|---|---|---|
| Admin login (separate JWT, AdminUser table) | **EXISTING** | `AdminUser` model, `authenticateAdmin` middleware, `AdminLogin.jsx` |
| SUPER_ADMIN / ADMIN / SUPPORT sub-roles | **EXISTING** | `AdminRole` enum in schema |
| Lead pipeline view + funnel metrics | **EXISTING** | `AdminDashboard.jsx`, `/admin/funnel` endpoint |
| Lead table with filters + CSV export | **EXISTING** | `LeadList.jsx`, `LeadDetail.jsx` |
| CC referral attribution oversight | **EXISTING** | `/admin/cc/sales`, `/admin/cc/commissions` |
| CCL joining-link oversight | **EXISTING** | `ccl.admin.controller.js`, `/admin/ccl/joining-links` |
| CC sales + commission view | **EXISTING** | `/admin/cc/sales`, `/admin/cc/commissions` |
| CCL sales + commission view | **EXISTING** | `/admin/ccl/sales`, `/admin/ccl/commissions` |
| CC payout batch generation + status management | **EXISTING** | `cc.admin.controller.js` payout endpoints |
| CCL payout batch generation + status management | **EXISTING** | `ccl.admin.controller.js` payout endpoints |
| Training content CRUD | **EXISTING** | `CclTrainingContent` model, file-upload support, `targetRole` field |
| Discount policy CRUD | **EXISTING** | `DiscountPolicy` model, `/admin/ccl/discount-policies` |
| Approve/reject CC or CCL onboarding | **MISSING** | No user status/approval workflow in User model |
| Manage plans & pricing UI | **PARTIAL** | `PricingPlan` schema exists; no admin UI page confirmed |
| Settlement trigger / pause | **PARTIAL** | Payout status can be set; no dedicated "pause settlement" flag |
| Admin user management (CRUD for admin users) | **NOT CONFIRMED** | AdminUser table exists; no admin-user CRUD endpoints found |
| Export reports (commissions, payouts) | **MISSING** | No CSV/export for CC/CCL payout data |
| Commission dispute management | **MISSING** | No dispute/flag field on commissions or payouts |
| SUPER_ADMIN vs ADMIN permission separation | **PARTIAL** | Sub-roles defined; no middleware checks enforcing SUPER_ADMIN-only actions |

---

### B. Career Counsellor (CC) Features

| Requirement | Status | Notes |
|---|---|---|
| CC login (JWT) | **EXISTING** | `StaffLogin.jsx` used for CC; JWT stored as `cg_staff_token` |
| CC dashboard | **EXISTING** | `CounsellorDashboard.jsx` with multi-tab layout |
| Account summary (wallet, sales, commissions, payouts) | **EXISTING** | `getAccountSummary()` in `cc.controller.js` |
| Transaction history (paginated) | **EXISTING** | `listTransactions()` in `cc.controller.js` |
| Referral link attribution | **EXISTING** | CC referral code stored on User; used during payment to attribute sale |
| Coupon creation (CC) | **EXISTING** | `POST /counsellor/coupons` with plan-capped discounts |
| 70% commission on net sales | **EXISTING** | `COMMISSION_RATE = 0.70` in `cc.controller.js` |
| Discount control (up to 20%) | **EXISTING** | `CcDiscount` model, `DiscountPolicy`, plan-aware cap enforced |
| Training section (videos/books) | **EXISTING** | `CclTrainingContent` (targetRole CCL/CC/ALL), training tab in dashboard |
| Payouts list | **EXISTING** — via API | `/counsellor/payouts` exists in controller mapping |
| Thursday payout scheduling | **EXISTING** — DB scheduling | `getNextThursday()` helper, `scheduledFor` on `CcPayout` |
| Actual bank transfer execution | **MISSING** | No Razorpay Payouts / bank transfer service code found |
| Multi-recipient send (send link to multiple students at once) | **MISSING** | Only single-recipient link creation UI |
| CC registration / onboarding flow | **PARTIAL** | `UserRole.CAREER_COUNSELLOR` enum exists; no dedicated register page |
| Bank account storage | **MISSING** | No `BankAccount` model in schema |
| WhatsApp/email notifications to CC | **MISSING** | WA automation only covers student events; no CC-facing notifications |
| Net sales formula clearly defined | **PARTIAL** | Commission on `netAmountPaise` computed; no tax/platform fee deduction modelled |
| Student direct purchase without CC | **EXISTING** | Normal `/assessments` + `/payments` flow requires no CC |

---

### C. Career Counsellor Lead (CCL) Features

| Requirement | Status | Notes |
|---|---|---|
| CCL login (JWT) | **EXISTING** | `StaffLogin.jsx`, JWT stored as `cg_staff_token` |
| CCL dashboard | **EXISTING** | `LeadDashboard.jsx` with multi-tab layout |
| Account summary | **EXISTING** | `getAccountSummary()` in `ccl.controller.js` |
| Transaction history (paginated) | **EXISTING** | `listTransactions()` in `ccl.controller.js` |
| Joining link creation (₹12,000) | **EXISTING** | `CclJoiningLink` model, `createJoiningLink()` |
| Joining link resolution + order creation | **EXISTING** | `resolveJoiningLink()`, `createJoiningOrder()` (public) |
| 10% commission on net sales | **EXISTING** | `COMMISSION_RATE = 0.10` in `ccl.controller.js` |
| Discount control (up to 20% on counsellor plans) | **EXISTING** | `CclDiscount`, `DiscountPolicy` at `role=CAREER_COUNSELLOR_LEAD` |
| Training section | **EXISTING** | Same `CclTrainingContent` table, `targetRole` scoping |
| Payouts list | **EXISTING** | `/staff/payouts` endpoint |
| Thursday payout scheduling | **EXISTING** — DB scheduling | Same `getNextThursday()` pattern |
| Actual bank transfer execution | **MISSING** | Same gap as CC |
| Multi-recipient send | **MISSING** | Only single-recipient joining link per form |
| CCL registration / onboarding flow | **PARTIAL** | `UserRole.CAREER_COUNSELLOR_LEAD` exists; no register page |
| Bank account storage | **MISSING** | No `BankAccount` model |
| WhatsApp/email to CCL | **MISSING** | No partner-facing notification events |
| Net sales formula defined | **PARTIAL** | Same gap as CC |
| All payments to cadgurukul.com | **EXISTING** | Razorpay order created centrally; payment never goes to partner |

---

### D. Student Direct Flow

| Requirement | Status | Notes |
|---|---|---|
| Guest assessment (no login) | **EXISTING** | Public `/assessments` route, 3 hook questions before lead capture |
| Lead capture mid-assessment | **EXISTING** | `LeadCaptureForm.jsx`, 3 fields |
| Free report (top 3 careers, blurred premium) | **EXISTING** | Free report rendering, `PremiumUpsell.jsx` |
| Paid flow: ₹499, ₹1,999, ₹9,999 | **EXISTING** | `PricingPlan`, value-ladder pricing, Razorpay |
| WhatsApp re-engagement | **EXISTING** | Multiple automation events implemented |
| Plan upgrade path | **EXISTING** | `PlanSelection.jsx`, `Payment.jsx` |

---

### E. Plans & Pricing

| Plan | Status | Notes |
|---|---|---|
| Free Plan | **EXISTING** | `planType=free`, `ReportAccessLevel.FREE` |
| ₹499 Plan | **EXISTING** | `planType=standard`, `amountPaise=49900` |
| ₹1,999 Plan | **EXISTING** | `planType=premium`, `amountPaise=199900` |
| ₹9,999 Plan | **EXISTING** | `planType=consultation`, `amountPaise=999900` |

---

### F. Assessment Logic

| Requirement | Status | Notes |
|---|---|---|
| AI-adaptive questions | **EXISTING** | OpenAI GPT-4o + Gemini fallback orchestration |
| Questions based on class | **PARTIAL** | `classStandard` in StudentProfile; AI prompt likely uses it |
| Questions based on age / board / stream / interests | **PARTIAL** | Fields exist in `StudentProfile`; AI usage NOT CONFIRMED |
| Structured question categories | **EXISTING** | `QuestionCategory` enum (APTITUDE, PERSONALITY, INTERESTS, etc.) |
| Assessment profile rule engine (deterministic rules) | **MISSING** | No `AssessmentProfile` / rule-input model; pure AI with no fallback rule set |
| Parent input into assessment | **MISSING** | `ParentDetail` model exists; no parent-input during assessment confirmed |
| Assessment question pool/template storage | **MISSING** | No `QuestionTemplate` model; questions generated per-session only |

---

## 2. Missing Features and Gaps

### Critical Gaps (Block core business operation)

1. **Bank Transfer Execution** — Payout records are created and scheduled, but there is no service that actually initiates a bank transfer (Razorpay Payouts API, NEFT, or manual reconciliation helper). Thursday payouts *log* a scheduled record but no money moves.

2. **BankAccount Model** — Partners cannot store bank account details (IFSC, account number, name). Without this, automated payouts cannot be routed.

3. **Partner Approval Workflow** — No `approvalStatus` on `User` model. A CCL/CC who registers gets full access immediately; Admin cannot approve/reject onboarding.

4. **Partner Registration Flow** — No dedicated register page or onboarding UX for CC or CCL roles. They appear to share the same `StaffLogin.jsx`.

5. **Net Sales Formula Gap** — `netAmountPaise = gross - discount` but no tax deduction, platform fee deduction, or refund adjustment is modelled. This will cause commission disputes.

6. **Thursday Cron Job** — No cron/scheduler service found. The "next Thursday" date is stored but no background job automatically triggers payout generation on Thursdays.

### Important Gaps (Affect product completeness)

7. **Multi-Recipient Send Modal** — Partners can create one link at a time. No bulk-send form exists.

8. **WhatsApp/Email to Partners** — Automation events cover students only. Partners get no WA/email on commission credited, payout processed, etc.

9. **Admin Partner Management UI** — No frontend page for Admin to view all CC/CCL users, approve them, view their individual commission ledgers, or suspend them.

10. **Admin Payout Trigger UI** — Payout batch API exists but no Admin UI page to trigger / review / approve payouts before they go to bank.

11. **Export (CC/CCL payouts / commissions)** — Only leads are exportable via CSV; no payout CSV export.

12. **Assessment Personalization Rules** — The AI receives student profile context, but there is no deterministic rule layer, question-pool selection logic, or fallback when AI is unavailable.

13. **Parent Input During Assessment** — Parents cannot contribute profile data that influences question selection.

14. **SUPER_ADMIN Permission Enforcement** — Sub-roles exist in enum but no middleware gates that restrict destructive operations to SUPER_ADMIN only.

15. **PricingPlan Admin UI** — The `PricingPlan` table exists but no admin page to manage plan fees or toggle active plans.

16. **Commission Dispute / Refund Handling** — No model or workflow for reversing a commission when a payment is refunded.

---

## 3. Recommended Architecture Changes

### 3.1 New Prisma Models Required

```
BankAccount              — partner bank details (encrypted)
PartnerApplication       — CC/CCL onboarding application with approval status
SettlementSchedule       — admin-configurable payout day/frequency
PayoutFraudFlag          — flag suspicious payout for manual review
CommissionAdjustment     — credit/debit correction on commissions
AssessmentProfileRule    — deterministic rule set for question pool selection
QuestionTemplate         — reusable question pool items
NotificationLog          — partner-facing notification history
```

### 3.2 Backend Service Changes

| Service | Change |
|---|---|
| `services/payout/payoutExecutionService.js` | NEW — abstracts bank transfer (Razorpay Payouts API or mock) |
| `services/payout/payoutScheduler.js` | NEW — cron-triggered Thursday settlement |
| `services/assessment/questionSelector.js` | NEW — rule-based question-pool selection before AI |
| `services/notification/partnerNotificationService.js` | NEW — WA/email events for partners |
| `services/payment/netSalesCalculator.js` | NEW — single source of truth for net sales formula |
| `cc.controller.js` / `ccl.controller.js` | ADD bank account endpoints |
| `auth.controller.js` | ADD partner register + approval gate |

### 3.3 Frontend Page Changes

| Page | Change |
|---|---|
| `pages/Staff/Register.jsx` | NEW — CC / CCL self-serve registration |
| `pages/Staff/BankAccount.jsx` | NEW — partner bank detail form |
| `pages/Admin/Partners.jsx` | NEW — admin partner management |
| `pages/Admin/Payouts.jsx` | NEW — admin payout trigger + review UI |
| `pages/Admin/Plans.jsx` | NEW — pricing plan CRUD |
| `pages/Public/JoinAsCC.jsx` | NEW — public CC landing/apply page |
| `components/MultiSendModal.jsx` | NEW — bulk recipient send |
| `components/AssessmentProfileForm.jsx` | NEW — parent-side profile input |

---

## 4. Database Schema Proposal

### 4.1 `BankAccount` (NEW)

```prisma
model BankAccount {
  id              String   @id @default(cuid())
  userId          String   @unique
  accountHolder   String
  // Store encrypted — use application-level AES-256-GCM before insert
  accountNumberEnc String   // encrypted
  ifscCode        String
  bankName        String
  accountType     String   @default("savings") // "savings" | "current"
  isVerified      Boolean  @default(false)
  verifiedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("bank_accounts")
}
```

Add to `User`: `bankAccount BankAccount?`

### 4.2 `PartnerApplication` (NEW)

```prisma
enum ApplicationStatus {
  pending
  approved
  rejected
  suspended
}

model PartnerApplication {
  id              String            @id @default(cuid())
  userId          String            @unique
  role            UserRole          // CAREER_COUNSELLOR | CAREER_COUNSELLOR_LEAD
  status          ApplicationStatus @default(pending)
  fullName        String
  phone           String
  city            String?
  qualification   String?
  experience      String?
  referredBy      String?           // cclUserId who referred this CC
  adminNotes      String?
  reviewedBy      String?           // adminUserId
  reviewedAt      DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([role])
  @@map("partner_applications")
}
```

Add to `User`:
```prisma
  isApproved        Boolean  @default(false)
  approvedAt        DateTime?
  partnerApplication PartnerApplication?
```

### 4.3 `SettlementSchedule` (NEW)

```prisma
model SettlementSchedule {
  id          String   @id @default(cuid())
  role        String   // "CC" | "CCL" | "ALL"
  dayOfWeek   Int      @default(4)  // 4 = Thursday (JS Date.getDay())
  isPaused    Boolean  @default(false)
  pausedBy    String?  // adminUserId
  pausedAt    DateTime?
  pauseReason String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@unique([role])
  @@map("settlement_schedules")
}
```

### 4.4 `CommissionAdjustment` (NEW)

Handles refund reversals and manual corrections without mutating the original commission.

```prisma
enum AdjustmentType {
  REFUND_REVERSAL
  PLATFORM_FEE
  MANUAL_CREDIT
  MANUAL_DEBIT
  TAX_DEDUCTION
}

model CommissionAdjustment {
  id              String         @id @default(cuid())
  role            String         // "CC" | "CCL"
  partnerId       String         // ccUserId or cclUserId
  commissionId    String?        // original commission ID if linked
  type            AdjustmentType
  amountPaise     Int            // positive = credit, negative = debit
  reason          String
  createdBy       String         // adminUserId
  createdAt       DateTime       @default(now())

  @@index([partnerId])
  @@index([type])
  @@map("commission_adjustments")
}
```

### 4.5 `AssessmentProfileRule` (NEW)

```prisma
model AssessmentProfileRule {
  id              String   @id @default(cuid())
  name            String
  classMin        Int?     // e.g. 8 for CLASS_8
  classMax        Int?     // e.g. 10 for CLASS_10
  ageMin          Int?
  ageMax          Int?
  boards          String[] @default([]) // ["CBSE","ICSE"] — empty = all
  streams         String[] @default([]) // ["Science","Commerce"] — empty = all
  // Which question categories to emphasise in this rule
  requiredCategories String[] @default([])
  questionCount   Int      @default(10)
  isActive        Boolean  @default(true)
  priority        Int      @default(0) // higher = evaluated first
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("assessment_profile_rules")
}
```

### 4.6 `QuestionTemplate` (NEW)

```prisma
model QuestionTemplate {
  id           String           @id @default(cuid())
  questionText String
  questionType QuestionType
  category     QuestionCategory
  options      Json?
  tags         String[]         @default([]) // ["science", "class9", "cbse"]
  classMin     Int?
  classMax     Int?
  ageMin       Int?
  ageMax       Int?
  streams      String[]         @default([])
  isActive     Boolean          @default(true)
  usageCount   Int              @default(0)
  createdBy    String?          // adminUserId
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([category])
  @@index([isActive])
  @@map("question_templates")
}
```

### 4.7 `PayoutFraudFlag` (NEW)

```prisma
enum FraudFlagStatus {
  open
  investigating
  cleared
  confirmed_fraud
}

model PayoutFraudFlag {
  id          String          @id @default(cuid())
  role        String          // "CC" | "CCL"
  partnerId   String
  payoutId    String
  reason      String
  status      FraudFlagStatus @default(open)
  resolvedBy  String?
  resolvedAt  DateTime?
  notes       String?
  createdAt   DateTime        @default(now())

  @@index([partnerId])
  @@index([status])
  @@map("payout_fraud_flags")
}
```

### 4.8 `NotificationLog` (NEW)

```prisma
enum NotificationChannel {
  whatsapp
  email
  sms
}

model NotificationLog {
  id          String              @id @default(cuid())
  userId      String
  channel     NotificationChannel
  templateKey String
  payload     Json
  status      WhatsAppStatus      @default(queued)
  sentAt      DateTime?
  errorMsg    String?
  createdAt   DateTime            @default(now())

  @@index([userId])
  @@index([channel])
  @@map("notification_logs")
}
```

### 4.9 Changes to Existing Models

**`User` model — add fields:**
```prisma
  isApproved        Boolean  @default(false)
  approvedAt        DateTime?
  suspendedAt       DateTime?
  bankAccount       BankAccount?
  partnerApplication PartnerApplication?
  notificationLogs  NotificationLog[]
```

**`CcPayout` / `CclPayout` — add fields:**
```prisma
  fraudFlagId   String?
  isFlagged     Boolean @default(false)
  bankAccountSnapshot Json? // snapshot of bank details at time of transfer
  transferInitiatedAt DateTime?
  transferRef   String?  // bank transfer / Razorpay Payout ID
```

**`Payment` — add fields:**
```prisma
  platformFeePaise    Int   @default(0)
  taxPaise            Int   @default(0)
  refundedAmountPaise Int   @default(0)
  netAmountPaise      Int?  // computed: amountPaise - platformFee - tax + refund
  ccAttributedSaleId  String? // FK back for reconciliation
  cclAttributedSaleId String?
```

---

## 5. Backend Modules and APIs

### 5.1 Partner Auth & Registration

```
POST   /api/v1/auth/partner/register
  Body: { email, password, name, phone, role: "CAREER_COUNSELLOR"|"CAREER_COUNSELLOR_LEAD",
          city?, qualification?, experience?, referredBy? }
  → Creates User (isApproved=false) + PartnerApplication (status=pending)
  → Returns: { message: "Application submitted. Await admin approval." }

POST   /api/v1/auth/partner/login
  Body: { email, password }
  → Checks isApproved=true; if not → 403 PENDING_APPROVAL
  → Returns: { accessToken, refreshToken, user }
```

**Middleware gate:**
```js
// middleware/requireApproved.js
module.exports = (req, res, next) => {
  if (!req.user.isApproved) {
    return res.status(403).json({ error: { code: 'PENDING_APPROVAL' } });
  }
  next();
};
```

### 5.2 Admin Partner Management

```
GET    /api/v1/admin/partners?role=&status=&page=&limit=
GET    /api/v1/admin/partners/:userId
PATCH  /api/v1/admin/partners/:userId/approve
PATCH  /api/v1/admin/partners/:userId/reject        Body: { reason }
PATCH  /api/v1/admin/partners/:userId/suspend       Body: { reason }
GET    /api/v1/admin/partners/:userId/commissions
GET    /api/v1/admin/partners/:userId/payouts
```

### 5.3 Bank Account Management

```
GET    /api/v1/counsellor/bank-account
PUT    /api/v1/counsellor/bank-account
  Body: { accountHolder, accountNumber, ifscCode, bankName, accountType }
  → Encrypts accountNumber with AES-256-GCM before storage

GET    /api/v1/staff/bank-account
PUT    /api/v1/staff/bank-account
  (Same pattern for CCL)

POST   /api/v1/admin/partners/:userId/verify-bank-account
  → Admin marks bank account as verified
```

### 5.4 Payout Execution Service

File: `backend/src/services/payout/payoutExecutionService.js`

```js
/**
 * Execute a single payout (CC or CCL).
 * Abstracts the actual bank transfer provider.
 * @param {object} payout - CcPayout or CclPayout record
 * @param {object} bankAccount - BankAccount record (decrypted)
 * @param {"CC"|"CCL"} role
 * @returns {{ success: boolean, transferRef?: string, error?: string }}
 */
async function executePayout(payout, bankAccount, role) {
  // Phase 1: Manual / mock mode (log only, return mock ref)
  // Phase 2: Razorpay Payouts API
  // Phase 3: NEFT/IMPS via banking partner
}
```

**Payout strategy enum (env var `PAYOUT_MODE`):**
- `manual` — logs the payout, marks status=pending_transfer, requires admin manual transfer
- `razorpay` — uses Razorpay Payouts API
- `mock` — dev mode, always succeeds

### 5.5 Thursday Settlement Cron

File: `backend/src/services/payout/payoutScheduler.js`

```js
const cron = require('node-cron');

// Every Thursday at 10:00 AM IST (04:30 UTC)
cron.schedule('30 4 * * 4', async () => {
  logger.info('[PayoutScheduler] Thursday settlement run started');

  const schedule = await prisma.settlementSchedule.findUnique({ where: { role: 'ALL' } });
  if (schedule?.isPaused) {
    logger.warn('[PayoutScheduler] Settlement is paused. Skipping.');
    return;
  }

  await runCCSettlement();
  await runCCLSettlement();
  logger.info('[PayoutScheduler] Thursday settlement run complete');
});

async function runCCSettlement() {
  // 1. Find all CC users with pending commissions
  // 2. Group by ccUserId, sum amountPaise
  // 3. Create CcPayout records (status=pending, scheduledFor=today)
  // 4. Mark commissions status=in_payout
  // 5. For each payout: look up BankAccount, call executePayout()
  // 6. Update payout status: paid | failed
  // 7. Send WA/email notification to partner
  // 8. Log to ActivityLog
}
```

### 5.6 Net Sales Calculator

File: `backend/src/services/payment/netSalesCalculator.js`

```
Net Sales = Gross Payment
            − Discount Applied
            − Platform Fee (configurable %, default 0%)
            − Tax Collected on Behalf (GST input, default 0)
            + 0 (refunds handled separately via CommissionAdjustment)

CC Commission  = Net Sales × 0.70
CCL Commission = Net Sales × 0.10
```

```js
function calculateNetSales({ grossAmountPaise, discountAmountPaise = 0, platformFeePct = 0, taxPaise = 0 }) {
  const platformFee = Math.round(grossAmountPaise * platformFeePct / 100);
  return grossAmountPaise - discountAmountPaise - platformFee - taxPaise;
}
```

### 5.7 Multi-Send Flow

```
POST /api/v1/staff/joining-links/bulk
  Body: {
    recipients: [...]
    expiryDays?: 7,
    discountPct?: 0
  }
  → Same for CCL joining links
```

### 5.8 Partner Notification Events

File: `backend/src/services/notification/partnerNotificationService.js`

| Event | Trigger | Channel |
|---|---|---|
| `partner_application_received` | After register | Email to partner |
| `partner_approved` | Admin approves | Email + WA to partner |
| `partner_rejected` | Admin rejects | Email to partner |
| `commission_credited` | Sale confirmed | WA to partner |
| `payout_initiated` | Payout status → processing | WA + Email to partner |
| `payout_paid` | Payout status → paid | WA + Email to partner |
| `payout_failed` | Payout status → failed | WA + Email to partner |
| `bank_account_verified` | Admin verifies | Email to partner |

### 5.9 Admin Payout Control

```
POST   /api/v1/admin/settlements/trigger
  Body: { role: "CC"|"CCL"|"ALL", dryRun?: true }
  → Runs settlement logic, returns preview if dryRun=true

POST   /api/v1/admin/settlements/pause
  Body: { role, reason }

POST   /api/v1/admin/settlements/resume
  Body: { role }

GET    /api/v1/admin/cc/payouts?status=&page=
PATCH  /api/v1/admin/cc/payouts/:id
  Body: { status: "processing"|"paid"|"failed", reference?, notes? }

GET    /api/v1/admin/ccl/payouts?status=&page=
PATCH  /api/v1/admin/ccl/payouts/:id
  (Same pattern)

GET    /api/v1/admin/cc/payouts/export?format=csv
GET    /api/v1/admin/ccl/payouts/export?format=csv
```

### 5.10 Assessment Personalization

```
GET    /api/v1/admin/assessment-rules
POST   /api/v1/admin/assessment-rules
PUT    /api/v1/admin/assessment-rules/:id
DELETE /api/v1/admin/assessment-rules/:id

GET    /api/v1/admin/question-templates?category=&classMin=&classMax=&stream=
POST   /api/v1/admin/question-templates
PUT    /api/v1/admin/question-templates/:id
DELETE /api/v1/admin/question-templates/:id
```

### 5.11 Admin Plans & Pricing

```
GET    /api/v1/admin/plans
POST   /api/v1/admin/plans
PUT    /api/v1/admin/plans/:id
PATCH  /api/v1/admin/plans/:id/toggle-active
```

---

## 6. Frontend Modules and Pages

### 6.1 New Pages Required

| File Path | Purpose |
|---|---|
| `pages/Staff/Register.jsx` | Partner self-serve register (role selector: CC or CCL) |
| `pages/Staff/PendingApproval.jsx` | Post-register holding page "Application under review" |
| `pages/Staff/BankAccount.jsx` | Partner bank detail form (IFSC lookup, account details) |
| `pages/Admin/Partners.jsx` | Admin partner management: list, filter, approve/reject |
| `pages/Admin/PartnerDetail.jsx` | Single partner: profile, bank, commissions, payouts |
| `pages/Admin/Payouts.jsx` | Admin payout dashboard: trigger, review batches, CSV export |
| `pages/Admin/Plans.jsx` | Admin pricing plan CRUD |
| `pages/Public/JoinAsCC.jsx` | Public landing "Join as Career Counsellor" → /staff/register |
| `pages/Public/JoinAsCCL.jsx` | Public landing "Join as CCL" → /staff/register |

### 6.2 New Components Required

| File Path | Purpose |
|---|---|
| `components/MultiSendModal.jsx` | Bulk recipient input, max 50 rows, sends via `/bulk` endpoint |
| `components/BankAccountForm.jsx` | IFSC validation, account number masking, submit handler |
| `components/PartnerStatusBadge.jsx` | Reusable approval/suspension status pill |
| `components/PayoutStatusBadge.jsx` | pending / processing / paid / failed colour-coded pill |
| `components/AssessmentProfileForm.jsx` | Parent-facing profile input before assessment start |
| `components/TrainingContentCard.jsx` | Shared between CC + CCL training tabs |
| `components/CommissionAdjustmentLog.jsx` | Admin view of manual adjustments per partner |

### 6.3 Existing Pages — Required Changes

| File | Change |
|---|---|
| `pages/Staff/StaffLogin.jsx` | Add link to `/staff/register`; handle 403 PENDING_APPROVAL |
| `pages/Counsellor/CounsellorDashboard.jsx` | Add "Bank Account" tab; keep referral link + coupon management visible |
| `pages/Staff/LeadDashboard.jsx` | Add "Bank Account" tab, "Multi Send" button on joining-links tab |
| `pages/Admin/AdminDashboard.jsx` | Add "Partners", "Payouts", "Plans" nav items |
| `pages/Assessment.jsx` | Add `AssessmentProfileForm` step before first question (optional, skippable) |
| `services/api.js` | Add `partnerAdminApi`, `settlementApi`, `bankAccountApi`, `questionTemplateApi` |

### 6.4 Route Changes (`App.jsx`)

```jsx
// Partner auth
{ path: '/staff/register',          element: <StaffRegister /> }
{ path: '/staff/pending-approval',  element: <PendingApproval /> }
{ path: '/staff/bank-account',      element: <BankAccount /> }  // protected

// Admin
{ path: '/admin/partners',          element: <AdminPartners /> }
{ path: '/admin/partners/:userId',  element: <AdminPartnerDetail /> }
{ path: '/admin/payouts',           element: <AdminPayouts /> }
{ path: '/admin/plans',             element: <AdminPlans /> }

// Public
{ path: '/join-as-counsellor',      element: <JoinAsCC /> }
{ path: '/join-as-ccl',             element: <JoinAsCCL /> }
```

---

## 7. Commission, Discount, Payout, and Attribution Logic

### 7.1 Net Sales Formula (Canonical Definition)

```
Gross Amount   = amount collected from student/candidate by Razorpay (in paise)
Discount       = amount waived by partner's discount setting (max 20% of gross)
Platform Fee   = configurable platform percentage (default: 0% for now; future: 2-5%)
Tax            = GST collected from student for platform (default: 0 for now)
                 Note: GST is a pass-through; cadgurukul.com pays it to govt
Refund         = amount refunded to student after payment (via CommissionAdjustment)

Net Sales = Gross - Discount - Platform Fee - Tax

CC Commission   = Net Sales × 0.70  (Career Counsellor, 70%)
CCL Commission  = Net Sales × 0.10  (Career Counsellor Lead, 10%)
```

**Idempotency rule:** Commission records are created once per `paymentId`. The unique constraint on `CcAttributedSale.paymentId` and `CclAttributedSale.paymentId` prevents double-crediting. Commission calculation must run inside a DB transaction.

### 7.2 Discount Cap Enforcement

```js
// Enforced in both createCoupon() and createJoiningLink()
const policy = await prisma.discountPolicy.findUnique({
  where: { role_planType: { role: 'CAREER_COUNSELLOR', planType } }
});
const cap = policy?.maxPct ?? 20;
const effectiveDiscount = Math.min(Math.max(0, requestedDiscount), cap);
```

Discount is stored on the coupon at creation time to freeze it — subsequent policy changes do not retroactively affect issued coupons.

### 7.3 Attribution Tracking

**CC Attribution Flow (counsellor referral link):**
1. Student opens counsellor referral link containing `ref=CODE`
2. Student clicks `Get Started Free / Start Free` or `Premium ₹499`
3. Student completes registration + email verification
4. On registration completion, persist `ref` on lead/user so the student is attributed to the counsellor account
5. If `Premium ₹499`, student pays → `POST /api/v1/payments/verify`
6. Backend: verify Razorpay signature → `createCcSaleAndCommission({ paymentId, ccUserId, ... })`
7. `CcAttributedSale` created, `CcCommission` created

**CCL Attribution Flow:**
1. Candidate clicks joining URL → `/join?ref=CODE`
2. Frontend resolves code via `GET /api/v1/join/:code`
3. Candidate pays joining fee → `POST /api/v1/join/:code/pay/verify`
4. Backend: verify signature → `createCclSaleAndCommission(linkId, paymentId)`
5. `CclJoiningLink.isUsed = true`, `CclAttributedSale` + `CclCommission` created

**Direct Student Flow (no partner):**
1. Student opens cadgurukul.com (no `ref` code)
2. Student clicks `Get Started Free / Start Free` → registration + email verification → registration complete → dashboard appears
3. Student clicks `Premium ₹499` → registration + email verification → registration complete → pays ₹499 → dashboard appears
4. Premium path shows no free test option; only the ₹499 test option
5. No commission created

### 7.4 Payout Eligibility

A commission is eligible for payout if:
- `status = 'pending'`
- The associated sale `status = 'confirmed'` (not refunded)
- Partner `isApproved = true`
- Partner `bankAccount` is set and `isVerified = true`
- Not flagged by `PayoutFraudFlag`

### 7.5 Weekly Thursday Settlement Logic

```
Step 1: Check SettlementSchedule.isPaused → abort if true
Step 2: For each role (CC, CCL):
  a. SELECT DISTINCT partnerId WHERE commission.status='pending' AND sale.status='confirmed'
  b. For each partnerId:
     i.  Check approvalStatus, bankAccount.isVerified
     ii. Sum eligible commissions → amount
     iii. Create PayoutRecord (status=pending, scheduledFor=today)
     iv. Mark commissions status=in_payout, payoutId=<new_payout_id>  [in transaction]
     v.  Decrypt bank account number
     vi. Call executePayout(payout, bankAccount)
     vii.If success: payout.status=paid, commission.status=paid, referral=<transferRef>
     viii.If fail: payout.status=failed, commissions reverted to pending, alert sent
Step 3: Log all outcomes to ActivityLog
Step 4: Send partner notifications (WA + email)
Step 5: If any failures: alert admin via email
```

**Retry strategy:**
- Failed payouts are retried on next Thursday run automatically (commissions reverted to pending in step viii)
- After 3 consecutive Thursday failures: `PayoutFraudFlag` created, payout held for manual review
- Admin can manually trigger a single payout retry: `POST /api/v1/admin/cc/payouts/:id/retry`

---

## 8. Assessment Personalization Logic

### 8.1 Current State
AI (GPT-4o / Gemini) generates questions per session using student profile as context. No deterministic pre-selection or fallback rule engine exists.

### 8.2 Proposed Rule-Based Pre-Selection Layer

```
INPUT: { age, classStandard, board, streamPreference, interests[], parentInputs{} }

Step 1: AssessmentProfileRule matching
  → Query rules ordered by priority DESC
  → Find first matching rule (classMin ≤ class ≤ classMax, board in boards, etc.)
  → Extract: requiredCategories[], questionCount

Step 2: Question Pool Selection (from QuestionTemplate)
  → For each requiredCategory: SELECT templates WHERE category=? AND classMin≤class≤classMax
  → Randomly sample proportionally (e.g. 3 APTITUDE, 3 INTERESTS, 2 PERSONALITY, 2 LOGICAL)
  → Return as seed questions

Step 3: AI Adaptive Layer
  → Feed: studentProfile + seedQuestion set + previous answers
  → AI selects/adapts next question from pool OR generates if pool is empty
  → Fallback: if AI fails, serve next static template question

Step 4: Parent Input Integration
  → Parent can submit via AssessmentProfileForm before assessment starts
  → Fields: parentOccupation, budgetPreference, locationPreference, subjectPreferences[]
  → These are merged into the AI prompt context for report generation
```

### 8.3 Question Category Distribution by Class

| Class | APTITUDE | INTERESTS | PERSONALITY | LOGICAL | STEM | CREATIVE |
|---|---|---|---|---|---|---|
| 8–9 | 3 | 4 | 2 | 2 | 2 | 2 |
| 10 | 3 | 3 | 2 | 3 | 3 | 2 |
| 11–12 | 4 | 3 | 2 | 4 | 3 | 1 |

Total questions scale: Free=10, Paid=15–30 adaptive

### 8.4 AI Prompt Strategy

```
System: "You are generating a career guidance assessment for a {age}-year-old student 
         in Class {class} studying {board} board, interested in {interests}.
         Parent notes: {parentInputs}
         Previous answers: {answeredQuestions}
         Select or generate the NEXT best question from category: {targetCategory}
         targeting this student's profile."
```

### 8.5 Fallback Logic

```
try:
  question = await generateWithAI(prompt, provider='openai')
catch OpenAI timeout/error:
  question = await generateWithAI(prompt, provider='gemini')
catch both fail:
  question = selectFromTemplate(requiredCategory, classStandard)  // static fallback
  log.warn('AI unavailable; served static template question')
```

### 8.6 Question Template Storage

`QuestionTemplate` records are seeded via `prisma/seed.js`. Admin UI at `/admin/question-templates` allows CRUD. Templates are tagged (e.g. `["class9", "cbse", "science"]`) and filtered during pool selection.

---

## 9. Admin Capabilities

### 9.1 Complete Admin Capability Matrix

| Capability | Route | Controller | Status |
|---|---|---|---|
| Login | `/admin/login` | `auth.controller` | **EXISTS** |
| View leads | `/admin/leads` | `admin.controller` | **EXISTS** |
| View funnel metrics | `/admin/funnel` | `admin.controller` | **EXISTS** |
| Update lead status | `PATCH /admin/leads/:id` | `admin.controller` | **EXISTS** |
| CC sales overview | `/admin/cc/sales` | `cc.admin.controller` | **EXISTS** |
| CC payout management | `/admin/cc/payouts` | `cc.admin.controller` | **EXISTS** |
| CCL joining link overview | `/admin/ccl/joining-links` | `ccl.admin.controller` | **EXISTS** |
| CCL sales overview | `/admin/ccl/sales` | `ccl.admin.controller` | **EXISTS** |
| CCL payout management | `/admin/ccl/payouts` | `ccl.admin.controller` | **EXISTS** |
| Training content CRUD | `/admin/ccl/training` | `ccl.admin.controller` | **EXISTS** |
| Discount policy CRUD | `/admin/ccl/discount-policies` | `ccl.admin.controller` | **EXISTS** |
| Partner approval workflow | `/admin/partners/:id/approve` | **MISSING** | **TO BUILD** |
| Plans & pricing CRUD | `/admin/plans` | **MISSING** | **TO BUILD** |
| Settlement trigger/pause | `/admin/settlements/trigger` | **MISSING** | **TO BUILD** |
| Payout export (CSV) | `/admin/cc/payouts/export` | **MISSING** | **TO BUILD** |
| Admin user CRUD | `/admin/users` | **NOT CONFIRMED** | **TO VERIFY** |
| Commission dispute handling | `/admin/commission-adjustments` | **MISSING** | **TO BUILD** |
| Bank account verification | `/admin/partners/:id/verify-bank` | **MISSING** | **TO BUILD** |
| Question template CRUD | `/admin/question-templates` | **MISSING** | **TO BUILD** |
| Assessment rule CRUD | `/admin/assessment-rules` | **MISSING** | **TO BUILD** |
| SUPER_ADMIN-only gates | middleware | **MISSING** | **TO BUILD** |

### 9.2 SUPER_ADMIN vs ADMIN vs SUPPORT

| Action | SUPER_ADMIN | ADMIN | SUPPORT |
|---|---|---|---|
| Approve/reject partners | ✓ | ✓ | ✗ |
| Trigger/pause settlements | ✓ | ✓ | ✗ |
| Manually adjust commissions | ✓ | ✗ | ✗ |
| Delete training content | ✓ | ✓ | ✗ |
| View all data | ✓ | ✓ | Read-only |
| CRUD plans/pricing | ✓ | ✓ | ✗ |
| Create admin users | ✓ | ✗ | ✗ |
| Verify bank accounts | ✓ | ✓ | ✗ |

Enforce via middleware:
```js
// middleware/requireRole.js
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  }
  next();
};
// Usage: router.post('/settlements/trigger', authenticateAdmin, requireRole('SUPER_ADMIN','ADMIN'), ...)
```

---

## 10. Weekly Settlement Automation Design

### 10.1 Cron Configuration

```js
// backend/src/services/payout/payoutScheduler.js
// Requires: npm install node-cron
const cron = require('node-cron');

// Thursday 10:00 AM IST = 04:30 UTC
const SETTLEMENT_CRON = process.env.SETTLEMENT_CRON || '30 4 * * 4';

module.exports = {
  start() {
    cron.schedule(SETTLEMENT_CRON, () => runSettlement(), { timezone: 'UTC' });
    logger.info(`[PayoutScheduler] Scheduled: ${SETTLEMENT_CRON}`);
  }
};
```

Mount in `src/server.js`:
```js
const { start: startPayoutScheduler } = require('./services/payout/payoutScheduler');
if (process.env.ENABLE_PAYOUT_SCHEDULER === 'true') {
  startPayoutScheduler();
}
```

### 10.2 Settlement Run Flow (Detailed)

```
runSettlement()
├── check SettlementSchedule.isPaused → skip if paused
├── for each role in ['CC', 'CCL']:
│   ├── query: eligible commissions (pending, sale confirmed, partner approved, bank verified)
│   ├── group by partnerId
│   └── for each partner batch:
│       ├── BEGIN TRANSACTION
│       │   ├── create PayoutRecord (status=pending, scheduledFor=TODAY)
│       │   └── update commissions status=in_payout, payoutId=<id>
│       └── COMMIT
│       ├── decrypt bankAccount.accountNumberEnc
│       ├── call executePayout(payout, bankAccount, role)
│       └── BEGIN TRANSACTION
│           ├── if success: payout.status=paid, transfer reference stored
│           ├── if fail:    payout.status=failed, commissions.status=pending (rollback eligibility)
│           └── COMMIT
│       └── send partner notification
├── aggregate results (paid_count, failed_count, total_amount)
├── if any failures: email admin alert
└── log to ActivityLog
```

### 10.3 Failure Handling

| Failure Scenario | Response |
|---|---|
| Bank account not set | Skip partner; log warning; notify partner to add bank account |
| Bank account not verified | Skip partner; flag for admin review |
| Bank transfer API error (transient) | Mark payout.status=failed; commissions revert to pending for next Thursday |
| Bank transfer API error (3rd consecutive) | Create PayoutFraudFlag; hold all payouts for this partner |
| Settlement paused by admin | Skip entire run; log reason |
| DB transaction failure | Rollback; payout not created; commissions untouched |

### 10.4 Reconciliation

Weekly: Admin can run `GET /api/v1/admin/settlements/reconcile?week=2026-W16` to:
- List all CcPayout + CclPayout for the given week
- Compare sum of commission.amountPaise vs payout.amountPaise
- Flag any discrepancy > ₹0

Monthly: Admin exports full CSV of all paid payouts for bank statement cross-check.

### 10.5 Environment Variables for Payout

```env
ENABLE_PAYOUT_SCHEDULER=true
SETTLEMENT_CRON=30 4 * * 4
PAYOUT_MODE=manual              # manual | razorpay | mock
RAZORPAY_PAYOUT_KEY_ID=...
RAZORPAY_PAYOUT_KEY_SECRET=...
BANK_ACCOUNT_ENCRYPTION_KEY=... # 32-byte hex for AES-256-GCM
ADMIN_ALERT_EMAIL=admin@cadgurukul.com
```

---

## 11. Risks and Edge Cases

### 11.1 Financial Risks

| Risk | Mitigation |
|---|---|
| Double commission credit | Unique constraint on `CcAttributedSale.paymentId`; commission creation in DB transaction |
| Payment refunded after commission paid | `CommissionAdjustment` (REFUND_REVERSAL type) deducts from next payout |
| Discount > 20% | Hard cap enforced in both backend validation and `DiscountPolicy.maxPct` |
| Payout to wrong bank account | BankAccount.isVerified gate; admin verification step mandatory before first payout |
| Razorpay webhook replay | Idempotency check: `Payment.razorpayOrderId` unique; re-verification of signature |
| Bank account number leaked | AES-256-GCM encryption at application layer before storage |

### 11.2 Operational Risks

| Risk | Mitigation |
|---|---|
| Thursday cron fires twice | PostgreSQL advisory lock or atomic `SettlementRun` record per Thursday date |
| Partner registers under wrong role | Role selector in register form; Admin can correct before approval |
| AI unavailable during assessment | Static question template fallback layer |
| Commission without payout (orphaned) | Reconciliation endpoint; admin alert if commission.status=pending AND age > 14 days |
| CCL refers fraudulent candidates | PayoutFraudFlag model; manual verification step for large payouts |
| Partner suspended mid-payout cycle | Eligibility check re-runs for each batch; suspended partners skipped |

### 11.3 Data Integrity Risks

| Risk | Mitigation |
|---|---|
| Legacy test-link edge cases | Deprecated (test links retired); referral/coupon flow is used |
| Commission on failed payment | Commission creation only after Razorpay signature verification |
| Net sales miscalculation | `netSalesCalculator.js` as single canonical service; unit-tested |

### 11.4 Security Risks

| Risk | Mitigation |
|---|---|
| JWT token leakage | Short-lived access tokens (15 min); refresh token rotation; `cg_staff_token` HttpOnly cookie (ideal) |
| Admin route accessible to CC/CCL | Separate `authenticateAdmin` middleware; Admin uses different JWT secret |
| Webhook spoofing (Razorpay) | HMAC-SHA256 signature verification on every webhook callback |
| Bank data in transit unencrypted | HTTPS enforced; accountNumber encrypted before leaving backend |
| SQL injection | Prisma parameterised queries; no raw SQL with user input |
| PII in logs | Logger scrubs sensitive fields (accountNumber, passwordHash, phone digits) |
| Rate limiting bypass | Per-IP + per-user rate limits on payment and link-creation endpoints |

---

## 12. Step-by-Step Implementation Roadmap

### Phase 1 — Partner Foundation (Weeks 1–3)

**Goal:** Allow CC and CCL to self-register, await admin approval, and receive access.

#### Sprint 1.1 — Auth & Approval (Week 1)
- [ ] Add `isApproved`, `approvedAt`, `suspendedAt` to `User` model
- [ ] Create `PartnerApplication` Prisma model + migration
- [ ] Build `POST /api/v1/auth/partner/register` controller (role-gated)
- [ ] Build `POST /api/v1/auth/partner/login` with `isApproved` gate
- [ ] Create `requireApproved` middleware
- [ ] Build Admin endpoints: `GET/PATCH /admin/partners` (list, approve, reject, suspend)
- [ ] Frontend: `pages/Staff/Register.jsx` with role selector
- [ ] Frontend: `pages/Staff/PendingApproval.jsx`
- [ ] Frontend: `pages/Admin/Partners.jsx` with approval action buttons

**Files to create:**
- `backend/prisma/migrations/20260500_001_partner_application/migration.sql`
- `backend/src/middleware/requireApproved.js`
- `backend/src/controllers/partner.auth.controller.js`
- `backend/src/routes/partner.auth.routes.js`
- `backend/src/controllers/partner.admin.controller.js`
- `frontend/src/pages/Staff/Register.jsx`
- `frontend/src/pages/Staff/PendingApproval.jsx`
- `frontend/src/pages/Admin/Partners.jsx`

**Files to modify:**
- `backend/prisma/schema.prisma` — add fields + PartnerApplication model
- `backend/src/routes/index.js` — mount `/auth/partner`
- `backend/src/routes/admin.routes.js` — mount `/admin/partners`
- `frontend/src/App.jsx` — add routes
- `frontend/src/services/api.js` — add partnerAuthApi, partnerAdminApi

#### Sprint 1.2 — Bank Account (Week 2)
- [ ] Create `BankAccount` Prisma model + migration
- [ ] Install and configure `crypto` AES-256-GCM helper (`utils/encryption.js`)
- [ ] Build `GET/PUT /api/v1/counsellor/bank-account` (CC)
- [ ] Build `GET/PUT /api/v1/staff/bank-account` (CCL)
- [ ] Build `POST /api/v1/admin/partners/:id/verify-bank-account`
- [ ] Frontend: `components/BankAccountForm.jsx`
- [ ] Frontend: add "Bank Account" tab to `CounsellorDashboard.jsx` + `LeadDashboard.jsx`
- [ ] Frontend: `pages/Admin/PartnerDetail.jsx` with bank verification button
- [ ] Add `BANK_ACCOUNT_ENCRYPTION_KEY` to `.env.example`

**Files to create:**
- `backend/prisma/migrations/20260500_002_bank_account/migration.sql`
- `backend/src/utils/encryption.js`
- `frontend/src/components/BankAccountForm.jsx`
- `frontend/src/pages/Admin/PartnerDetail.jsx`

**Files to modify:**
- `backend/prisma/schema.prisma` — add BankAccount model
- `backend/src/controllers/cc.controller.js` — add bank account handlers
- `backend/src/controllers/ccl.controller.js` — add bank account handlers
- `backend/src/routes/counsellor.routes.js`
- `backend/src/routes/staff.routes.js`
- `frontend/src/pages/Counsellor/CounsellorDashboard.jsx`
- `frontend/src/pages/Staff/LeadDashboard.jsx`

#### Sprint 1.3 — Partner Notifications (Week 3)
- [ ] Create `NotificationLog` Prisma model + migration
- [ ] Build `partnerNotificationService.js` (WA + email for partner events)
- [ ] Wire notifications into: approve/reject, commission_credited, payout_initiated, payout_paid
- [ ] Test with stub WA provider

**Files to create:**
- `backend/src/services/notification/partnerNotificationService.js`
- `backend/prisma/migrations/20260500_003_notification_log/migration.sql`

---

### Phase 2 — Payout Execution (Weeks 4–5)

**Goal:** Money actually moves to bank accounts on Thursdays.

#### Sprint 2.1 — Settlement Infrastructure (Week 4)
- [ ] Create `SettlementSchedule` Prisma model (seed one row per role) + migration
- [ ] Create `CommissionAdjustment` Prisma model + migration
- [ ] Create `PayoutFraudFlag` Prisma model + migration
- [ ] Add `isFlagged`, `transferRef`, `bankAccountSnapshot` to Payout models
- [ ] Build `netSalesCalculator.js`
- [ ] Build `payoutEligibilityChecker.js`
- [ ] Build `payoutExecutionService.js` (PAYOUT_MODE=manual as default)
- [ ] Build `payoutScheduler.js` with `node-cron`
- [ ] Admin API: `POST /admin/settlements/trigger`, `/pause`, `/resume`
- [ ] Admin API: `PATCH /admin/cc/payouts/:id`, `PATCH /admin/ccl/payouts/:id`
- [ ] Admin API: CSV export for payouts
- [ ] Frontend: `pages/Admin/Payouts.jsx`

**Install:** `npm install node-cron` in backend

**Files to create:**
- `backend/src/services/payout/netSalesCalculator.js`
- `backend/src/services/payout/payoutEligibilityChecker.js`
- `backend/src/services/payout/payoutExecutionService.js`
- `backend/src/services/payout/payoutScheduler.js`
- `backend/src/controllers/settlement.admin.controller.js`
- `frontend/src/pages/Admin/Payouts.jsx`

**Files to modify:**
- `backend/src/server.js` — start scheduler
- `backend/src/routes/admin.routes.js` — mount settlement routes
- `backend/prisma/schema.prisma`

#### Sprint 2.2 — Refund & Adjustment Handling (Week 5)
- [ ] Build refund webhook handler for Razorpay
- [ ] On refund: update `Payment.refundedAmountPaise`, create `CommissionAdjustment` (REFUND_REVERSAL)
- [ ] Adjustment deducted from next payout calculation
- [ ] Admin: `POST /admin/commission-adjustments` (manual credit/debit)
- [ ] Admin: view adjustments per partner in `PartnerDetail.jsx`

---

### Phase 3 — Multi-Send & Bulk Flows (Week 6)

**Goal:** Partners can send links to multiple recipients at once.

- [ ] Build `POST /api/v1/staff/joining-links/bulk`
- [ ] WA message sent to each recipient with their unique link URL
- [ ] Rate limit bulk endpoint: max 50 per call, max 200 per day per partner
- [ ] Frontend: `components/MultiSendModal.jsx`
- [ ] Wire into LeadDashboard joining-links tab

**Files to create:**
- `frontend/src/components/MultiSendModal.jsx`

**Files to modify:**
- `backend/src/controllers/ccl.controller.js`
- `frontend/src/pages/Staff/LeadDashboard.jsx`

---

### Phase 4 — Assessment Personalization (Weeks 7–8)

**Goal:** Questions adapt based on student profile via rule engine + template pool.

#### Sprint 4.1 — Template Pool & Rules (Week 7)
- [ ] Create `AssessmentProfileRule` + `QuestionTemplate` Prisma models + migration
- [ ] Seed initial question templates (50–100 questions across all categories and class ranges)
- [ ] Build `questionSelector.js` service
- [ ] Admin API: CRUD for assessment rules and question templates
- [ ] Wire `questionSelector` into assessment controller: call before AI generation
- [ ] Implement static fallback in `generateNextQuestion()`

**Files to create:**
- `backend/src/services/assessment/questionSelector.js`
- `backend/src/controllers/assessmentRule.admin.controller.js`
- `backend/prisma/seeds/questionTemplates.js`

#### Sprint 4.2 — Parent Input & Profile Form (Week 8)
- [ ] Add parent-input fields schema (absorbed into `StudentProfile`)
- [ ] Frontend: `components/AssessmentProfileForm.jsx` (optional pre-assessment step)
- [ ] Wire parent inputs into AI prompt context in `assessmentService.js`
- [ ] Allow parent-role user to submit profile before assessment

---

### Phase 5 — Admin Completeness (Week 9)

- [ ] `pages/Admin/Plans.jsx` — pricing plan CRUD
- [ ] Admin endpoint: `GET/POST/PUT/PATCH /admin/plans`
- [ ] `pages/Admin/Partners.jsx` enhancements: sort, filter by role/status, bulk approve
- [ ] SUPER_ADMIN-only middleware gates on destructive endpoints
- [ ] Admin: commission dispute flag + resolution workflow
- [ ] Admin: AdminUser CRUD (verify if missing; build if so)
- [ ] Commission adjustment log component in `PartnerDetail.jsx`

---

### Phase 6 — Polish, Security & Monitoring (Week 10)

- [ ] Full audit log review (all financial operations logged to `ActivityLog`)
- [ ] PII scrubbing in logger (phone, email, account numbers)
- [ ] Rate limiting on: `/auth/partner/register` (10/hour), `/payments/verify` (5/min/IP), `/bulk` (200/day/user)
- [ ] Webhook signature verification audit (Razorpay payment + payout webhooks)
- [ ] `BANK_ACCOUNT_ENCRYPTION_KEY` rotation strategy documented
- [ ] Add `bankAccountSnapshot` JSON backup on payout initiation
- [ ] Load test payout scheduler with 100 partners
- [ ] Documentation: `docs/partner-onboarding.md`, `docs/payout-process.md`

---

## 13. Exact Files Likely to Change

### Backend

| File | Change Type |
|---|---|
| `backend/prisma/schema.prisma` | ADD 8 new models, modify User, Payment, Payout models |
| `backend/src/server.js` | MODIFY — start payout scheduler |
| `backend/src/routes/index.js` | MODIFY — mount new route files |
| `backend/src/routes/admin.routes.js` | MODIFY — add partner, settlement, plan, template, rule routes |
| `backend/src/routes/counsellor.routes.js` | MODIFY — add bank account, bulk test-link routes |
| `backend/src/routes/staff.routes.js` | MODIFY — add bank account, bulk joining-link routes |
| `backend/src/controllers/cc.controller.js` | MODIFY — add bank account, bulk send handlers |
| `backend/src/controllers/ccl.controller.js` | MODIFY — add bank account, bulk send handlers |
| `backend/src/controllers/auth.controller.js` | MODIFY — add partner register/login |
| `backend/src/controllers/payment.controller.js` | MODIFY — add refund webhook handler; store netAmountPaise |
| `backend/src/services/cc/ccPaymentService.js` | MODIFY — use netSalesCalculator |
| `backend/src/services/ccl/cclPaymentService.js` | MODIFY — use netSalesCalculator |
| `backend/src/middleware/auth.js` | MODIFY — add requireApproved, requireRole |
| **NEW FILES** | |
| `backend/src/controllers/partner.auth.controller.js` | NEW |
| `backend/src/controllers/partner.admin.controller.js` | NEW |
| `backend/src/controllers/settlement.admin.controller.js` | NEW |
| `backend/src/controllers/assessmentRule.admin.controller.js` | NEW |
| `backend/src/middleware/requireApproved.js` | NEW |
| `backend/src/middleware/requireRole.js` | NEW |
| `backend/src/services/payout/netSalesCalculator.js` | NEW |
| `backend/src/services/payout/payoutEligibilityChecker.js` | NEW |
| `backend/src/services/payout/payoutExecutionService.js` | NEW |
| `backend/src/services/payout/payoutScheduler.js` | NEW |
| `backend/src/services/notification/partnerNotificationService.js` | NEW |
| `backend/src/services/assessment/questionSelector.js` | NEW |
| `backend/src/utils/encryption.js` | NEW |
| `backend/src/routes/partner.auth.routes.js` | NEW |

### Frontend

| File | Change Type |
|---|---|
| `frontend/src/App.jsx` | MODIFY — add 8 new routes |
| `frontend/src/services/api.js` | MODIFY — add 5+ new API clients |
| `frontend/src/pages/Admin/AdminDashboard.jsx` | MODIFY — add nav items |
| `frontend/src/pages/Counsellor/CounsellorDashboard.jsx` | MODIFY — add bank account tab, multi-send button |
| `frontend/src/pages/Staff/LeadDashboard.jsx` | MODIFY — add bank account tab, multi-send button |
| `frontend/src/pages/Staff/StaffLogin.jsx` | MODIFY — add register link, handle 403 |
| `frontend/src/pages/Assessment.jsx` | MODIFY — add optional profile form step |
| **NEW FILES** | |
| `frontend/src/pages/Staff/Register.jsx` | NEW |
| `frontend/src/pages/Staff/PendingApproval.jsx` | NEW |
| `frontend/src/pages/Staff/BankAccount.jsx` | NEW |
| `frontend/src/pages/Admin/Partners.jsx` | NEW |
| `frontend/src/pages/Admin/PartnerDetail.jsx` | NEW |
| `frontend/src/pages/Admin/Payouts.jsx` | NEW |
| `frontend/src/pages/Admin/Plans.jsx` | NEW |
| `frontend/src/pages/Public/JoinAsCC.jsx` | NEW |
| `frontend/src/pages/Public/JoinAsCCL.jsx` | NEW |
| `frontend/src/components/MultiSendModal.jsx` | NEW |
| `frontend/src/components/BankAccountForm.jsx` | NEW |
| `frontend/src/components/AssessmentProfileForm.jsx` | NEW |
| `frontend/src/components/PartnerStatusBadge.jsx` | NEW |
| `frontend/src/components/PayoutStatusBadge.jsx` | NEW |

### Database Migrations

| Migration Name | Purpose |
|---|---|
| `20260500_001_partner_application` | PartnerApplication model + User.isApproved |
| `20260500_002_bank_account` | BankAccount model |
| `20260500_003_notification_log` | NotificationLog model |
| `20260500_004_settlement_schedule` | SettlementSchedule model |
| `20260500_005_commission_adjustment` | CommissionAdjustment model |
| `20260500_006_payout_fraud_flag` | PayoutFraudFlag model |
| `20260500_007_assessment_personalization` | AssessmentProfileRule + QuestionTemplate |
| `20260500_008_payment_net_fields` | Payment.platformFeePaise, taxPaise, netAmountPaise |
| `20260500_009_payout_transfer_fields` | CcPayout/CclPayout transfer fields |

---

## 14. MVP Scope vs Phase 2 Scope

### MVP Scope (Ship First — Max 6 Weeks)

These are the **blocking gaps** that prevent the business from operating correctly end-to-end:

| # | Item | Priority |
|---|---|---|
| 1 | Partner registration + admin approval workflow | CRITICAL |
| 2 | Bank account model + storage (encrypted) | CRITICAL |
| 3 | Payout execution service (manual mode first) | CRITICAL |
| 4 | Thursday cron scheduler | CRITICAL |
| 5 | Net sales formula as canonical service | CRITICAL |
| 6 | requireApproved middleware gate | CRITICAL |
| 7 | Admin: Partners list + approve/reject UI | HIGH |
| 8 | Admin: Payout trigger + status UI | HIGH |
| 9 | Partner: Bank account tab (frontend) | HIGH |
| 10 | Partner notifications (WA/email on payout, commission) | HIGH |
| 11 | Refund → CommissionAdjustment reversal | HIGH |
| 12 | SettlementSchedule.isPaused flag (admin can pause) | MEDIUM |

**Deliverable state at MVP end:**
- A CC can register, await admin approval, log in, set bank details
- A CCL can do the same
- Thursday cron runs, generates payout records, initiates (manual mode: creates record for admin to transfer)
- Admin can approve partners, see all payouts, mark them paid, export CSV
- Commission math is canonical and unit-tested

### Phase 2 Scope (After MVP Stable — Weeks 7–12)

| # | Item | Priority |
|---|---|---|
| 1 | Razorpay Payouts API integration (replace manual mode) | HIGH |
| 2 | Multi-send modal (bulk test/joining links) | HIGH |
| 3 | Assessment rule engine + question template pool | HIGH |
| 4 | Parent input during assessment | MEDIUM |
| 5 | Admin: Plans & Pricing CRUD UI | MEDIUM |
| 6 | Admin: Question template + assessment rule CRUD | MEDIUM |
| 7 | SUPER_ADMIN permission enforcement middleware | MEDIUM |
| 8 | Admin: Commission dispute / adjustment workflow | MEDIUM |
| 9 | Payout fraud flagging after 3 failures | MEDIUM |
| 10 | Admin: Bank account verification workflow | MEDIUM |
| 11 | Public CC/CCL landing pages (/join-as-counsellor) | LOW |
| 12 | Payout reconciliation endpoint | LOW |
| 13 | PII scrubbing in logger | LOW |
| 14 | AdminUser CRUD (if confirmed missing) | LOW |

---

## Summary Table

| Area | Existing | Partial | Missing |
|---|---|---|---|
| Admin login & dashboard | ✓ | | |
| Admin lead management | ✓ | | |
| Admin CC/CCL oversight | ✓ | | |
| Admin payout management | | ✓ (API only) | UI, CSV export, trigger |
| Admin partner approval | | | ✓ |
| Admin plans pricing UI | | ✓ (schema only) | ✓ |
| CC login | ✓ | | |
| CC dashboard | ✓ | | |
| CC account/wallet | ✓ | | |
| CC transaction history | ✓ | | |
| CC referral attribution | ✓ | | |
| CC discount control | ✓ | | |
| CC training section | ✓ | | |
| CC bank account | | | ✓ |
| CC multi-send | | | ✓ |
| CC registration/onboarding | | ✓ | |
| CC actual bank transfer | | | ✓ |
| CC partner notifications | | | ✓ |
| CCL login | ✓ | | |
| CCL dashboard | ✓ | | |
| CCL account/wallet | ✓ | | |
| CCL transaction history | ✓ | | |
| CCL joining links | ✓ | | |
| CCL discount control | ✓ | | |
| CCL training section | ✓ | | |
| CCL bank account | | | ✓ |
| CCL multi-send | | | ✓ |
| CCL registration/onboarding | | ✓ | |
| CCL actual bank transfer | | | ✓ |
| CCL partner notifications | | | ✓ |
| Student direct flow | ✓ | | |
| All 4 plans (pricing) | ✓ | | |
| Assessment AI adaptive | ✓ | | |
| Assessment rule engine | | | ✓ |
| Question template pool | | | ✓ |
| Parent input to assessment | | | ✓ |
| Thursday cron scheduler | | | ✓ |
| Net sales formula (canonical) | | ✓ | |
| Commission refund reversal | | | ✓ |
| Payout execution (real bank) | | | ✓ |
| Payout fraud detection | | | ✓ |
| Settlement pause/resume | | | ✓ |
| WhatsApp automation (students) | ✓ | | |
| WhatsApp automation (partners) | | | ✓ |
| Bank account encryption | | | ✓ |
| SUPER_ADMIN permission gates | | ✓ | |
| Razorpay webhook verification | ✓ | | |
| Rate limiting | ✓ | | |
| Audit logs | ✓ | | |
