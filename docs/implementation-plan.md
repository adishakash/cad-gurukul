# CAD Gurukul — Full Implementation Plan & Gap Analysis
> Prepared: April 2026 | Based on current codebase audit
> Stack: Node.js 20 · Express · Prisma 5 · PostgreSQL 15 · React 18 · Razorpay · WhatsApp

---

## 1. Current Feature Audit

### Legend
- ✅ **EXISTING** — fully implemented, production-ready
- ⚠️ **PARTIAL** — schema/backend or frontend exists but not complete end-to-end
- ❌ **MISSING** — not present in any layer
- ❓ **NOT CONFIRMED** — README / code is ambiguous

---

### 1.1 Core Student Flow

| Feature | Status | Notes |
|---|---|---|
| Guest assessment (3 questions, no login) | ✅ EXISTING | Public `/assessment` route, in-progress |
| Lead capture form (name/phone/class) | ✅ EXISTING | `LeadCaptureForm.jsx`, mid-assessment mode |
| Adaptive AI questions (GPT-4o + Gemini fallback) | ✅ EXISTING | `aiOrchestrator.js`, `promptTemplates.js` |
| Free report (top 3 careers, blurred teaser) | ✅ EXISTING | `CareerReport`, `FREE` access level |
| Paid report (₹499 – 7 careers, PDF) | ✅ EXISTING | `PAID` access level, Puppeteer PDF |
| Premium AI report (₹1,999) | ✅ EXISTING | `reportType = "premium"`, GPT-4o priority |
| 1:1 Counselling plan (₹9,999) | ✅ EXISTING | `planType = "consultation"`, WhatsApp confirm |
| Razorpay payment (UPI, cards, net banking) | ✅ EXISTING | `razorpayService.js`, webhook verify |
| WhatsApp automation events (10 triggers) | ✅ EXISTING | `automationService.js`, provider-agnostic |
| Student dashboard with upgrade CTA | ✅ EXISTING | `Dashboard.jsx`, premium teaser |
| Student direct purchase (no partner broker) | ✅ EXISTING | Standard `/payments` flow |
| Lead dedup by email + phone | ✅ EXISTING | Applied in April 2026 funnel optimisation |
| PDF download (lifetime access) | ✅ EXISTING | `ReportDownload` model |
| Redux Toolkit auth/store | ✅ EXISTING | Token management |

### 1.2 Admin Panel

| Feature | Status | Notes |
|---|---|---|
| Admin login (separate JWT, `ADMIN` role) | ✅ EXISTING | `admin.controller.js`, `AdminLogin.jsx` |
| `SUPER_ADMIN` / `ADMIN` / `SUPPORT` sub-roles | ⚠️ PARTIAL | `AdminRole` enum in `AdminUser` model, `ADMIN_PANEL_ROLES` config. Role-based *within* admin not yet enforced in controllers |
| Lead pipeline view (funnel metrics) | ✅ EXISTING | `AdminDashboard.jsx`, `LeadList.jsx` |
| Lead detail (events, inline status editor) | ✅ EXISTING | `LeadDetail.jsx` |
| User list (paginated, searchable) | ✅ EXISTING | `GET /admin/users` |
| User activate/deactivate | ⚠️ PARTIAL | `isActive` field exists, no API endpoint to toggle |
| Payments list | ✅ EXISTING | `GET /admin/payments` |
| Reports list | ✅ EXISTING | `GET /admin/reports` |
| Analytics / funnel metrics | ✅ EXISTING | `getAnalytics`, 30-day widget |
| Manage pricing plans | ⚠️ PARTIAL | `PricingPlan` model exists; no admin CRUD API/UI |
| Manage training content | ⚠️ PARTIAL | `CclTrainingContent` model + admin endpoints in `cc.admin.controller.js` and `ccl.admin.controller.js`; no dedicated admin UI page |
| Manage discount policies | ⚠️ PARTIAL | `DiscountPolicy` model + admin endpoints in `ccl.admin.controller.js`; no admin UI |
| View CC/CCL sales & commissions | ⚠️ PARTIAL | Admin API endpoints exist; no Admin frontend pages |
| Trigger / approve payouts for CC | ⚠️ PARTIAL | `POST /admin/cc/payouts/generate` exists; no admin UI page |
| Trigger / approve payouts for CCL | ⚠️ PARTIAL | `POST /admin/ccl/payouts/generate` exists; no admin UI page |
| Export CSV | ⚠️ PARTIAL | Lead CSV export exists; no payment/commission CSV |
| Activity logs / audit trail | ⚠️ PARTIAL | `ActivityLog` model; logged in controllers; no admin UI view |
| CC onboarding approval/reject | ❌ MISSING | No workflow. Users are created directly via `register`. |
| CCL onboarding approval/reject | ❌ MISSING | Same gap. |
| Partner user management (list/view CC, CCL) | ❌ MISSING | No admin UI; API returns all users but no role filter UI |
| Pause/unpause settlement | ❌ MISSING | No global settlement pause flag |
| Commission dispute management | ❌ MISSING | No dispute model or workflow |

### 1.3 Career Counsellor (CC) Portal

Note: Test links are retired. CCs use a single referral link plus coupon codes.

| Feature | Status | Notes |
|---|---|---|
| CC login (shared auth, `CAREER_COUNSELLOR` role) | ✅ EXISTING | `StaffLogin.jsx` → staff JWT; `STAFF_PORTAL_ROLES` config |
| CC dashboard (`CounsellorDashboard.jsx`) | ⚠️ PARTIAL | Account summary, referral link, coupons, payouts shown; training tab present |
| Wallet balance / commission earned display | ✅ EXISTING | `GET /counsellor/account` → `totalCommissionPaise`, `pendingPayoutPaise`, `paidAmountPaise` |
| Total sales / net sales display | ⚠️ PARTIAL | `totalSalesPaise` shown; **net sales** not separately computed/displayed |
| Transaction history (paginated) | ✅ EXISTING | `GET /counsellor/account/transactions` |
| Payouts list | ✅ EXISTING | `GET /counsellor/payouts` |
| Training section (videos/books) | ⚠️ PARTIAL | `CclTrainingContent` model (targetRole="CC") exists; backend `/counsellor/training` likely exposed; **no frontend training page component** |
| Discount control (plan-capped) | ✅ EXISTING | `CcDiscount` model; `discountPct`, policy cap + absolute cap enforced; toggle in dashboard |
| All student payments go to platform | ✅ EXISTING | Razorpay order created centrally; CC never handles money |
| Commission = 70% of net sales | ✅ EXISTING | `COMMISSION_RATE = 0.70` in `ccPaymentService.js` |
| Thursday auto-payout (scheduled) | ⚠️ PARTIAL | `scheduledFor = getNextThursday()` stored; **no cron job runs it automatically** |
| Bank account registration | ❌ MISSING | No `BankAccount` model; no UI to enter bank details |
| Actual bank transfer execution | ❌ MISSING | No Razorpay Payout API / NEFT integration; status is updated manually |
| CC registration / onboarding form | ❌ MISSING | No `/register/counsellor` page; CC accounts must be created by admin |
| WhatsApp notification on payout | ❓ NOT CONFIRMED | `automationService` has no `cc_payout_processed` event |

### 1.4 Career Counsellor Lead (CCL) Portal

| Feature | Status | Notes |
|---|---|---|
| CCL login (shared auth, `CAREER_COUNSELLOR_LEAD` role) | ✅ EXISTING | `StaffLogin.jsx`; `STAFF_PORTAL_ROLES` config |
| CCL dashboard (`LeadDashboard.jsx`) | ⚠️ PARTIAL | Account summary, joining links, payouts, training tab shown; no multi-send |
| Wallet balance / commission earned | ✅ EXISTING | `GET /staff/account` aggregates commissions |
| Total joins / revenue generated | ⚠️ PARTIAL | `totalSalesCount` = joins; **revenue generated not separately broken out from commissions** |
| Transaction history (paginated) | ✅ EXISTING | `GET /staff/account/transactions` |
| Payouts list | ✅ EXISTING | `GET /staff/payouts` |
| Training section (videos/books) | ⚠️ PARTIAL | Backend content served; **frontend training tab in `LeadDashboard` exists but is basic (no video player, no progress)** |
| Joining link generation (single candidate) | ✅ EXISTING | `POST /staff/joining-links`; ₹12,000 fee |
| Joining link multi-send | ❌ MISSING | No bulk send; no multi-recipient modal |
| Discount control (up to 20% for CC plans) | ✅ EXISTING | `CclDiscount` model; `DiscountPolicy` model; cap enforced |
| All payments go to platform | ✅ EXISTING | Razorpay order created centrally |
| CCL commission = 10% of net sales | ✅ EXISTING | `COMMISSION_RATE = 0.10` in `cclPaymentService.js` |
| Thursday auto-payout | ⚠️ PARTIAL | `scheduledFor` set; **no cron job** |
| Bank account registration | ❌ MISSING | No `BankAccount` model or UI |
| Actual bank transfer | ❌ MISSING | No Razorpay Payout API integration |
| CCL registration / onboarding form | ❌ MISSING | No `/register/ccl` page |
| WhatsApp notification on payout | ❓ NOT CONFIRMED | No `ccl_payout_processed` automation event |

### 1.5 Assessment Engine

| Feature | Status | Notes |
|---|---|---|
| Adaptive AI question generation | ✅ EXISTING | Profile-aware prompt (`buildQuestionGenerationPrompt`) |
| Category rotation (9 categories) | ✅ EXISTING | Avoids already-answered categories |
| Question count limits by plan | ✅ EXISTING | `FREE=10`, `PAID=30` |
| Personalization by age/class/board | ⚠️ PARTIAL | Passed to prompt; no structured rule engine (e.g. "CLASS_8 → only APTITUDE+INTERESTS") |
| Parent input integration | ⚠️ PARTIAL | `ParentDetail` model exists; prompt does not consume it |
| AI fallback (GPT-4o → Gemini) | ✅ EXISTING | `aiOrchestrator.js` |
| Stream preference / interests in prompt | ✅ EXISTING | Passed from `StudentProfile` |
| Assessment rule templates / question pools | ❌ MISSING | No static question bank; pure AI generation only |
| Aptitude level scoring | ⚠️ PARTIAL | Evaluation produces scores; no pre-assessment aptitude gate |

### 1.6 Pricing & Plans

| Feature | Status | Notes |
|---|---|---|
| Free plan (₹0) | ✅ EXISTING | `planType = "free"` |
| Standard plan (₹499) | ✅ EXISTING | `planType = "standard"` |
| Premium AI plan (₹1,999) | ✅ EXISTING | `planType = "premium"` |
| 1:1 Counselling (₹9,999) | ✅ EXISTING | `planType = "consultation"` |
| `PricingPlan` model | ✅ EXISTING | DB-driven, `isActive`, `displayOrder` |
| Discount cap enforcement (20%) | ✅ EXISTING | Enforced in both CC and CCL controllers |
| Net sales formula documented/formalized | ⚠️ PARTIAL | Computed in service; not formally defined |

---

## 2. Missing Features & Gaps

### Critical Gaps (Blocks MVP)

| # | Gap | Impact |
|---|---|---|
| G1 | **No bank account model/UI** | Payouts have nowhere to transfer to |
| G2 | **No actual bank transfer execution** | Payout rows are created but money never moves |
| G3 | **No Thursday cron job** | Auto-settlement is schema-ready but never fires |
| G4 | **No CC/CCL registration flow** | Partners can't self-onboard |
| G5 | **No admin CC/CCL user management UI** | Admin can't approve, view, or manage partners |
| G6 | **No multi-send flow** | Core requirement for test/joining link distribution |

### Important Gaps (Phase 2)

| # | Gap | Impact |
|---|---|---|
| G7 | Net sales not separately surfaced | Counsellors see gross only; misleading |
| G8 | No payout WhatsApp/email notification | Partners don't know when money is transferred |
| G9 | No CC/CCL onboarding approval workflow | No admin gate before partner goes live |
| G10 | No admin payout approval UI | Admin must use raw API calls |
| G11 | No training frontend pages | Books/videos not accessible |
| G12 | No commission dispute model | No path to resolve errors |
| G13 | Admin sub-role enforcement missing | SUPPORT can do anything ADMIN can |
| G14 | No settlement pause/resume control | Admin can't stop payouts globally |
| G15 | No assessment rule templates | All questions purely AI-generated; risk of inconsistency |
| G16 | Parent input not wired into assessment prompt | Reduces personalization |
| G17 | No CSV export for commissions/payouts | Admin reporting incomplete |
| G18 | No user activate/deactivate API endpoint | Admin UI field but no backend action |

---

## 3. Recommended Architecture Changes

### 3.1 Auth Architecture

Current state uses two separate auth paths:
- `User` table → student/CC/CCL JWT (via `authenticate` middleware)
- `AdminUser` table → admin JWT (via `authenticateAdmin` middleware with `type: "admin"` claim)

**Recommendation:** Keep this dual-table approach for security isolation. Extend the `User`-based path for partners.

Changes needed:
- Add `SUPER_ADMIN` to `UserRole` enum so super-admins can use unified login (or keep them in `AdminUser`)
- Add `approvalStatus` field to `User` for CC/CCL onboarding gate
- Partner registration flow → creates `User` with `CAREER_COUNSELLOR` or `CAREER_COUNSELLOR_LEAD` role + `approvalStatus = "pending"` → blocked from portal until admin approves
- `authenticate` middleware already supports all roles; add `requireRole(...roles)` guard used on partner routes

### 3.2 Service Architecture Additions

```
backend/src/services/
  ├── bank/               NEW — BankTransferService (Razorpay Payout API abstraction)
  ├── settlement/         NEW — settlementService.js (Thursday batch logic)
  ├── notification/       NEW — notificationService.js (partner-facing WhatsApp/email)
  └── assessment/         NEW — assessmentRuleEngine.js (profile-based question selection rules)
```

### 3.3 Frontend Architecture Additions

```
frontend/src/pages/
  ├── Partner/            NEW — shared partner registration/onboarding
  ├── Counsellor/
  │   ├── CounsellorDashboard.jsx    EXISTING (extend)
  │   ├── TrainingLibrary.jsx        NEW
  │   ├── WalletAccount.jsx          NEW (dedicated wallet screen)
  │   ├── PayoutsScreen.jsx          NEW
  │   └── MultiSendModal.jsx         NEW
  ├── Staff/
  │   ├── LeadDashboard.jsx          EXISTING (extend)
  │   ├── TrainingLibrary.jsx        NEW
  │   ├── WalletAccount.jsx          NEW
  │   ├── PayoutsScreen.jsx          NEW
  │   └── MultiSendModal.jsx         NEW
  └── Admin/
      ├── AdminDashboard.jsx         EXISTING (extend)
      ├── PartnerManagement.jsx      NEW — CC/CCL list, approve/reject
      ├── PayoutManagement.jsx       NEW — approve/trigger/pause payouts
      ├── TrainingManager.jsx        NEW — CRUD for training content
      ├── DiscountPolicyManager.jsx  NEW
      └── CommissionReports.jsx      NEW
```

---

## 4. Database Schema Proposal

### 4.1 Schema Changes Required

#### A. Add `approvalStatus` and `bankAccountId` to `User`

```prisma
enum PartnerApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

model User {
  // ... existing fields ...
  approvalStatus  PartnerApprovalStatus? // null for STUDENT/PARENT/ADMIN
  approvedAt      DateTime?
  approvedByAdmin String?                // AdminUser.id

  bankAccount     BankAccount?
}
```

#### B. New: `BankAccount`

```prisma
model BankAccount {
  id                String   @id @default(cuid())
  userId            String   @unique
  accountHolderName String
  accountNumber     String   // AES-256-GCM encrypted at rest
  ifscCode          String
  bankName          String
  accountType       String   @default("savings") // "savings" | "current"
  isVerified        Boolean  @default(false)
  verifiedAt        DateTime?
  isPrimary         Boolean  @default(true)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("bank_accounts")
}
```

> **Security note:** `accountNumber` must be encrypted using AES-256-GCM before storage. Use a KMS-backed key, not the JWT secret.

#### C. New: `WalletAccount` + `WalletTransaction`

The current design tracks commissions directly in `CcCommission` / `CclCommission` without a separate wallet ledger. This makes it hard to show a real-time "balance" without complex aggregation. A wallet model provides a single source of truth.

```prisma
enum WalletOwnerType {
  CAREER_COUNSELLOR
  CAREER_COUNSELLOR_LEAD
}

model WalletAccount {
  id            String          @id @default(cuid())
  userId        String          @unique
  ownerType     WalletOwnerType
  balancePaise  Int             @default(0) // current available balance
  lifetimeEarnedPaise Int       @default(0)
  lifetimePayoutPaise Int       @default(0)
  updatedAt     DateTime        @updatedAt
  createdAt     DateTime        @default(now())

  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions  WalletTransaction[]

  @@index([userId])
  @@map("wallet_accounts")
}

enum WalletTxType {
  COMMISSION_CREDIT      // sale attributed → commission added
  PAYOUT_DEBIT           // Thursday transfer → balance reduced
  ADJUSTMENT_CREDIT      // admin manual credit
  ADJUSTMENT_DEBIT       // admin manual debit (correction)
  REFUND_REVERSAL        // sale refunded → commission clawed back
}

model WalletTransaction {
  id              String       @id @default(cuid())
  walletId        String
  type            WalletTxType
  amountPaise     Int          // always positive; direction determined by type
  balanceAfter    Int          // snapshot of balance after this transaction
  referenceId     String?      // commissionId or payoutId for tracing
  referenceType   String?      // "CcCommission" | "CclCommission" | "CcPayout" | "CclPayout"
  description     String?
  idempotencyKey  String       @unique // prevent double-posting; use commissionId + type
  createdAt       DateTime     @default(now())

  wallet          WalletAccount @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@index([walletId])
  @@index([referenceId])
  @@index([createdAt])
  @@map("wallet_transactions")
}
```

#### D. New: `SettlementSchedule` (pause/resume control)

```prisma
enum SettlementTargetRole {
  CAREER_COUNSELLOR
  CAREER_COUNSELLOR_LEAD
  ALL
}

model SettlementSchedule {
  id          String                @id @default(cuid())
  targetRole  SettlementTargetRole  @default(ALL)
  scheduledFor DateTime              // next Thursday date
  isPaused    Boolean               @default(false)
  pausedByAdmin String?             // AdminUser.id
  pausedReason String?
  ranAt       DateTime?
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  @@index([scheduledFor])
  @@map("settlement_schedules")
}
```

#### E. New: `PartnerOnboarding` (approval workflow)

```prisma
enum OnboardingStatus {
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
}

model PartnerOnboarding {
  id               String           @id @default(cuid())
  userId           String           @unique
  role             String           // "CAREER_COUNSELLOR" | "CAREER_COUNSELLOR_LEAD"
  fullName         String
  phone            String
  city             String?
  experience       String?          // free-text: "3 years in education"
  linkedinUrl      String?
  motivation       String?
  status           OnboardingStatus @default(SUBMITTED)
  reviewedByAdmin  String?
  reviewNote       String?
  reviewedAt       DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  user             User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@map("partner_onboardings")
}
```

#### F. New: `MultiSendBatch` (multi-recipient link distribution)

```prisma
model MultiSendBatch {
  id           String   @id @default(cuid())
  senderUserId String
  role         String   // "CAREER_COUNSELLOR" | "CAREER_COUNSELLOR_LEAD"
  recipients   Json     // [{ name, email, phone, linkCode }]
  totalSent    Int      @default(0)
  failedCount  Int      @default(0)
  channel      String   @default("whatsapp") // "whatsapp" | "email" | "both"
  createdAt    DateTime @default(now())

  @@index([senderUserId])
  @@map("multi_send_batches")
}
```

#### G. New: `AssessmentRuleTemplate`

```prisma
model AssessmentRuleTemplate {
  id            String   @id @default(cuid())
  name          String
  classRange    String[] // ["CLASS_8","CLASS_9"] — applicable classes
  ageMin        Int?
  ageMax        Int?
  boards        String[] // applicable boards or empty for all
  categoryWeights Json   // { "APTITUDE": 30, "PERSONALITY": 20, ... }  — must sum to 100
  questionCount Int
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("assessment_rule_templates")
}
```

#### H. New: `CommissionDispute`

```prisma
enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  DISMISSED
}

model CommissionDispute {
  id              String        @id @default(cuid())
  raisedByUserId  String
  commissionType  String        // "CC" | "CCL"
  commissionId    String        // CcCommission.id or CclCommission.id
  reason          String
  status          DisputeStatus @default(OPEN)
  adminNote       String?
  resolvedByAdmin String?
  resolvedAt      DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([raisedByUserId])
  @@index([status])
  @@map("commission_disputes")
}
```

### 4.2 Existing Schema — Fields to Add

```prisma
// User model additions
model User {
  approvalStatus  PartnerApprovalStatus?
  approvedAt      DateTime?
  approvedByAdmin String?

  // New relations
  bankAccount         BankAccount?
  walletAccount       WalletAccount?
  partnerOnboarding   PartnerOnboarding?
}

// CcPayout additions — for bank transfer tracking
model CcPayout {
  bankAccountId   String?   // FK to BankAccount
  transferRef     String?   // Razorpay payout ID or NEFT UTR
  failureReason   String?
}

// CclPayout additions
model CclPayout {
  bankAccountId   String?
  transferRef     String?
  failureReason   String?
}
```

---

## 5. Backend Modules & APIs

### 5.1 New / Extended Route Modules

#### Partner Auth & Onboarding — `/api/v1/partner`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/partner/register` | Public | Create CC or CCL user account (approvalStatus=PENDING) |
| POST | `/partner/login` | Public | Login for CC/CCL (same as `/auth/login` — consider unifying) |
| GET | `/partner/me` | CC/CCL | Get own profile + approval status |
| PUT | `/partner/me` | CC/CCL | Update own profile |
| POST | `/partner/bank-account` | CC/CCL (approved only) | Register bank account |
| GET | `/partner/bank-account` | CC/CCL | Get own bank account (masked) |

#### Admin Partner Management — `/api/v1/admin/partners`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/partners` | ADMIN | List all CC/CCL users (paginated, filterable by role/status) |
| GET | `/admin/partners/:id` | ADMIN | Get partner detail |
| POST | `/admin/partners/:id/approve` | ADMIN | Approve partner onboarding |
| POST | `/admin/partners/:id/reject` | ADMIN | Reject with reason |
| POST | `/admin/partners/:id/suspend` | ADMIN | Suspend partner |
| GET | `/admin/partners/:id/commissions` | ADMIN | Commission history for partner |

#### Bank Account — `/api/v1/partner/bank-account`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/partner/bank-account` | CC/CCL | Submit bank details |
| GET | `/partner/bank-account` | CC/CCL | Fetch masked bank details |
| PUT | `/partner/bank-account` | CC/CCL | Update bank details |

#### Wallet — extend existing account endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/counsellor/wallet` | CC | Real-time wallet balance + WalletTransaction history |
| GET | `/staff/wallet` | CCL | Same for CCL |

#### Multi-Send — `/api/v1/staff/joining-links/bulk`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/staff/joining-links/bulk` | CCL (approved) | Create N joining links + send |
| GET | `/staff/joining-links/bulk/:batchId` | CCL | Get batch status |

#### Admin Payout Management — `/api/v1/admin/payouts`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/payouts/cc` | ADMIN | All CC payout batches |
| GET | `/admin/payouts/ccl` | ADMIN | All CCL payout batches |
| POST | `/admin/payouts/cc/generate` | ADMIN | Manually trigger CC payout batch |
| POST | `/admin/payouts/ccl/generate` | ADMIN | Manually trigger CCL payout batch |
| POST | `/admin/payouts/cc/:payoutId/approve` | ADMIN | Approve individual CC payout |
| POST | `/admin/payouts/ccl/:payoutId/approve` | ADMIN | Approve individual CCL payout |
| POST | `/admin/payouts/cc/:payoutId/reject` | ADMIN | Reject with reason |
| POST | `/admin/payouts/settle` | SUPER_ADMIN | Trigger actual bank transfer for approved payouts |
| POST | `/admin/settlement/pause` | SUPER_ADMIN | Pause all Thursday settlements |
| POST | `/admin/settlement/resume` | SUPER_ADMIN | Resume settlements |

#### Assessment Rules — `/api/v1/admin/assessment-rules`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/assessment-rules` | ADMIN | List rule templates |
| POST | `/admin/assessment-rules` | ADMIN | Create rule template |
| PUT | `/admin/assessment-rules/:id` | ADMIN | Update |
| DELETE | `/admin/assessment-rules/:id` | ADMIN | Deactivate |

#### Admin Reports & Exports

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/reports/commissions/export` | ADMIN | CSV of all commissions |
| GET | `/admin/reports/payouts/export` | ADMIN | CSV of all payouts |
| GET | `/admin/reports/sales/export` | ADMIN | CSV of attributed sales |

### 5.2 New Service Files

```
backend/src/services/
  bank/
    bankTransferService.js   — abstraction: Razorpay Payout API or stub
  settlement/
    settlementService.js     — batch logic: query pending commissions → create payout → debit wallet
    settlementCron.js        — node-cron Thursday 09:00 IST runner
  notification/
    partnerNotificationService.js  — WhatsApp/email for payout events, commission credits
  assessment/
    assessmentRuleEngine.js  — select rule template by class/age/board; compute category weights
  wallet/
    walletLedgerService.js   — credit/debit wallet atomically with idempotency key
```

### 5.3 Key Service Contracts

#### `walletLedgerService.creditCommission({ commissionId, userId, amountPaise })`
```js
// Idempotency key: `commission_credit_${commissionId}`
// Transaction: 
//   1. Upsert WalletAccount for userId
//   2. Create WalletTransaction (type=COMMISSION_CREDIT, idempotencyKey)
//   3. Increment WalletAccount.balancePaise and lifetimeEarnedPaise
// Returns: { walletTransaction, newBalance }
```

#### `settlementService.runThursdayBatch({ targetRole })`
```js
// 1. Check SettlementSchedule.isPaused for targetRole
// 2. Query all commissions with status='pending' for all active partners
// 3. Group by userId
// 4. For each user:
//    a. Sum pending commissions
//    b. Verify bank account exists and is verified
//    c. Create Payout row (status='approved')
//    d. Mark commissions as 'in_payout'
//    e. Debit WalletAccount via walletLedgerService.debitPayout()
// 5. Trigger bankTransferService.initiateTransfer() for each approved payout
// 6. Send partnerNotificationService.payoutInitiated() notification
// 7. Log SettlementSchedule.ranAt
// Returns: { processed, skipped, failed }
```

#### `bankTransferService.initiateTransfer({ payoutId, userId, amountPaise })`
```js
// 1. Fetch BankAccount for userId
// 2. If RAZORPAY_PAYOUT_ENABLED=true: call Razorpay Payout API
//    POST https://api.razorpay.com/v1/payouts
//    { account_number: fundAccount, amount: amountPaise, currency: "INR", 
//      mode: "NEFT", purpose: "payout", fund_account_id: ... }
// 3. Store transferRef on Payout row
// 4. Update Payout.status = 'processing'
// Fallback (stub): log intent, status = 'manual_pending'
// Webhook /api/v1/webhooks/razorpay-payout updates status to 'paid' or 'failed'
```

---

## 6. Frontend Modules & Pages

### 6.1 New Pages & Components

#### Partner Registration & Onboarding

| File | Path | Purpose |
|---|---|---|
| `PartnerRegister.jsx` | `pages/Partner/PartnerRegister.jsx` | Unified CC/CCL self-registration form |
| `PartnerOnboarding.jsx` | `pages/Partner/PartnerOnboarding.jsx` | Post-registration supplemental details (experience, LinkedIn) |
| `PendingApproval.jsx` | `pages/Partner/PendingApproval.jsx` | Shown when `approvalStatus = PENDING` |
| `BankAccountForm.jsx` | `pages/Partner/BankAccountForm.jsx` | Register/update bank details |

#### Counsellor (CC) Portal — extend `CounsellorDashboard.jsx`

| File | Path | Purpose |
|---|---|---|
| `TrainingLibrary.jsx` | `pages/Counsellor/TrainingLibrary.jsx` | Browse videos/books from `CclTrainingContent` |
| `WalletAccount.jsx` | `pages/Counsellor/WalletAccount.jsx` | Real-time balance, lifetime earned, WalletTransactions |
| `PayoutsScreen.jsx` | `pages/Counsellor/PayoutsScreen.jsx` | Payout history, next payout date, bank info |
| `MultiSendModal.jsx` | `components/MultiSendModal.jsx` | Add N recipients, create links, trigger send |
| `DiscountControl.jsx` | `components/DiscountControl.jsx` | Toggle discount + set %, pull policy from API |

#### Staff (CCL) Portal — extend `LeadDashboard.jsx`

| File | Path | Purpose |
|---|---|---|
| `TrainingLibrary.jsx` | `pages/Staff/TrainingLibrary.jsx` | Same as CC training but filtered by targetRole |
| `WalletAccount.jsx` | `pages/Staff/WalletAccount.jsx` | CCL wallet |
| `PayoutsScreen.jsx` | `pages/Staff/PayoutsScreen.jsx` | CCL payout history |
| `MultiSendModal.jsx` | Shared component | Reuse from Counsellor |

#### Admin Portal — extend `AdminDashboard.jsx`

| File | Path | Purpose |
|---|---|---|
| `PartnerManagement.jsx` | `pages/Admin/PartnerManagement.jsx` | List CC/CCL, filter by role/status, approve/reject |
| `PartnerDetail.jsx` | `pages/Admin/PartnerDetail.jsx` | Full partner profile + commission history |
| `PayoutManagement.jsx` | `pages/Admin/PayoutManagement.jsx` | All payouts, approve/trigger/pause settlement |
| `TrainingManager.jsx` | `pages/Admin/TrainingManager.jsx` | CRUD training content, upload file, set targetRole |
| `DiscountPolicyManager.jsx` | `pages/Admin/DiscountPolicyManager.jsx` | Manage discount policy per role/planType |
| `CommissionReports.jsx` | `pages/Admin/CommissionReports.jsx` | Aggregated CC/CCL commission data + CSV export |

### 6.2 Routing Changes (`App.jsx`)

```jsx
// Partner routes
<Route path="/partner/register" element={<PartnerRegister />} />
<Route path="/partner/onboarding" element={<RequireRole role="CC|CCL"><PartnerOnboarding /></RequireRole>} />
<Route path="/partner/bank-account" element={<RequireApproved><BankAccountForm /></RequireApproved>} />

// CC routes
<Route path="/counsellor/training" element={<RequireRole role="CAREER_COUNSELLOR"><TrainingLibrary /></RequireRole>} />
<Route path="/counsellor/wallet" element={<RequireRole role="CAREER_COUNSELLOR"><WalletAccount /></RequireRole>} />
<Route path="/counsellor/payouts" element={<RequireRole role="CAREER_COUNSELLOR"><PayoutsScreen /></RequireRole>} />

// CCL routes  
<Route path="/staff/training" element={<RequireRole role="CAREER_COUNSELLOR_LEAD"><TrainingLibrary /></RequireRole>} />
<Route path="/staff/wallet" element={<RequireRole role="CAREER_COUNSELLOR_LEAD"><WalletAccount /></RequireRole>} />
<Route path="/staff/payouts" element={<RequireRole role="CAREER_COUNSELLOR_LEAD"><PayoutsScreen /></RequireRole>} />

// Admin routes
<Route path="/admin/partners" element={<RequireAdmin><PartnerManagement /></RequireAdmin>} />
<Route path="/admin/partners/:id" element={<RequireAdmin><PartnerDetail /></RequireAdmin>} />
<Route path="/admin/payouts" element={<RequireAdmin><PayoutManagement /></RequireAdmin>} />
<Route path="/admin/training" element={<RequireAdmin><TrainingManager /></RequireAdmin>} />
<Route path="/admin/discount-policies" element={<RequireAdmin><DiscountPolicyManager /></RequireAdmin>} />
<Route path="/admin/commission-reports" element={<RequireAdmin><CommissionReports /></RequireAdmin>} />
```

---

## 7. Commission, Discount, Payout & Attribution Logic

### 7.1 Net Sales Formula (Formalized)

```
Gross Amount     = Plan base price (₹499, ₹1,999, ₹9,999, or ₹12,000 joining)
Discount Amount  = Gross × discountPct / 100   (capped at 20%; 0 if no discount)
Net Amount       = Gross - Discount             (this is what Razorpay charges the student)
Platform Amount  = Net Amount                   (all money goes to cadgurukul.com Razorpay account)
Commission       = Net Amount × commissionRate  (70% for CC, 10% for CCL)
Platform Margin  = Net Amount × (1 - commissionRate)
```

**Exclusions from Net Sales:**
- Razorpay processing fees (~2%) are NOT deducted before commission calculation in current schema. This is a business decision — **NOT CONFIRMED** whether platform bears this or deducts from partner commission. **Recommendation:** Platform bears it; keep Net Amount = Gross - Discount.
- Tax (GST) on the platform: CAD Gurukul collects GST separately if applicable; commissions are on pre-tax net.
- Refunds: if `CclAttributedSale.status = "refunded"`, a `WalletTransaction(REFUND_REVERSAL)` must claw back the commission.

### 7.2 Commission Calculation — Idempotency

Both `ccPaymentService.js` and `cclPaymentService.js` use `CcAttributedSale.paymentId @unique` as the idempotency key. Second calls with the same `paymentId` return the existing record.

**Add wallet credit call inside the same DB transaction:**
```js
// Inside createCcSaleAndCommission (after commission.create):
await walletLedgerService.creditCommission({
  commissionId: commission.id,
  userId: ccUserId,
  amountPaise: commissionPaise,
  tx, // pass Prisma transaction client
});
```

### 7.3 Discount Rules

| Role | Plan | Max Discount | Enforced In |
|---|---|---|---|
| CC | ₹499 plan | 100% | `cc.controller.js` + `DiscountPolicy` |
| CC | ₹1,999 plan | 20% | Same |
| CC | ₹9,999 plan | 20% | Same |
| CCL | ₹12,000 joining | 20% | `ccl.controller.js` + `DiscountPolicy` |

Discount is applied via CC coupons at checkout and capped by the DiscountPolicy plus absolute plan limits. Admin can adjust policy via `DiscountPolicy`.

### 7.4 Attribution Rules

- **CC attribution**: via the CC referral code in the payment URL. The student follows the link → creates Razorpay order with CC context → on success, `createCcSaleAndCommission()` fires.
- **CCL attribution**: via `CclJoiningLink.code`. The counsellor candidate follows → ₹12,000 joining payment → `createCclSaleAndCommission()` fires.
- **Direct student purchase**: no `ref` code → normal Payment flow → no commission created. ✅ EXISTING.
- **Multiple attributions**: each link code is unique and `@unique` constrained; one payment = one attributed sale.

### 7.5 Payout Eligibility

A commission is eligible for the next Thursday payout if:
1. `status = "pending"` (not already in a payout batch)
2. The attributed sale `status = "confirmed"` (not refunded)
3. The partner `User.approvalStatus = "APPROVED"` and `isActive = true`
4. Partner has a verified `BankAccount` (`isVerified = true`)
5. The `SettlementSchedule` for the relevant Thursday is not paused

Minimum payout threshold: **₹0** (no minimum defined in requirements; implement a ₹100 floor as a safeguard).

### 7.6 Thursday Auto-Payout Sequence

```
Thursday 09:00 IST (cron)
  ├─ settlementCron.js fires
  ├─ settlementService.runThursdayBatch({ role: 'CAREER_COUNSELLOR' })
  │   ├─ Group pending CC commissions by userId
  │   ├─ For each CC user:
  │   │   ├─ Create CcPayout (status=approved, scheduledFor=today)
  │   │   ├─ Link commissions to payout (status=in_payout)
  │   │   ├─ walletLedgerService.debitPayout(...)
  │   │   └─ bankTransferService.initiateTransfer(...)
  │   └─ Log results
  └─ settlementService.runThursdayBatch({ role: 'CAREER_COUNSELLOR_LEAD' })
      └─ Same for CCL
```

---

## 8. Assessment Personalization Logic

### 8.1 Profile Input → Question Strategy

The current `buildQuestionGenerationPrompt` passes raw profile to the AI. This works but produces inconsistent category distribution. The proposed rule engine adds a deterministic layer:

```js
// assessmentRuleEngine.js
function selectRuleTemplate(profile) {
  // Find the best-matching AssessmentRuleTemplate by classRange/ageRange/board
  // Return: { categoryWeights: { APTITUDE: 30, PERSONALITY: 20, ... }, questionCount }
}

function buildCategorySequence(categoryWeights, questionCount) {
  // Expand weights into ordered category list
  // e.g. { APTITUDE: 30%, PERSONALITY: 20%, ... } × 10 questions
  // = [APTITUDE, APTITUDE, APTITUDE, PERSONALITY, PERSONALITY, INTERESTS, ...]
  // Shuffle within groups for variety
}
```

### 8.2 Recommended Category Weights by Class

| Class | APTITUDE | PERSONALITY | INTERESTS | STEM_NON_STEM | LOGICAL | CREATIVE | SOCIAL | VOCATIONAL |
|---|---|---|---|---|---|---|---|---|
| 8–9 | 20% | 20% | 25% | 10% | 10% | 10% | 5% | 0% |
| 10 | 25% | 20% | 20% | 15% | 10% | 5% | 5% | 0% |
| 11–12 (Science) | 30% | 15% | 15% | 20% | 15% | 0% | 5% | 0% |
| 11–12 (Commerce) | 25% | 20% | 20% | 5% | 15% | 5% | 10% | 0% |
| 11–12 (Arts) | 20% | 20% | 25% | 0% | 10% | 20% | 5% | 0% |

### 8.3 Parent Input Integration

`ParentDetail` fields to add to assessment prompt:
- `parentOccupation` → influence "vocational awareness" questions
- Parent's budget preference → from `StudentProfile.budgetPreference`
- Willingness to send child abroad

In `buildQuestionGenerationPrompt`, add a `parentContext` section:
```js
const parentContext = profile.parentDetail
  ? `Parent: ${profile.parentDetail.occupation || 'unknown occupation'}, 
     Budget: ${profile.budgetPreference || 'unspecified'}`
  : 'No parent data available.';
```

### 8.4 AI Fallback Logic

```
Question generation attempt:
  1. Try OpenAI GPT-4o (primary)
  2. If error or >3s timeout → Gemini 1.5 Pro (fallback)
  3. If both fail → pull from static question pool (AssessmentRuleTemplate.staticQuestions JSON)
  4. If pool empty → return generic INTERESTS question (hardcoded safe fallback)
```

The static pool (to build): admin stores JSON arrays of pre-written questions per category. Used as emergency fallback only.

---

## 9. Admin Capabilities (Full Specification)

### 9.1 User Management
- List all users (filter by role, search by email/phone)
- View user detail (profile, assessments, payments, linked lead)
- Activate / deactivate user account (`PATCH /admin/users/:id/status`)
- Role change: promote STUDENT to COUNSELLOR, etc. (SUPER_ADMIN only)
- View user's complete payment history

### 9.2 Partner Management
- List CC/CCL by approval status (PENDING / APPROVED / REJECTED / SUSPENDED)
- View partner detail: profile, bank account (masked), commission summary, payout history
- Approve / reject with reason
- Suspend active partner (freezes payout eligibility)
- Edit partner's discount policy
- View all links created by partner

### 9.3 Pricing & Plan Management
- CRUD operations on `PricingPlan` rows
- Toggle plan active/inactive
- Change display order

### 9.4 Training Content Management
- Create/edit/delete `CclTrainingContent` items
- Upload files (video/PDF) — served from `/uploads/training/`
- Set `targetRole` (CC / CCL / ALL)
- Toggle visibility (`isActive`)
- Reorder items (`displayOrder`)

### 9.5 Discount Policy Management
- View/edit `DiscountPolicy` per role+planType
- Set min/max discount range
- Toggle policy active/inactive

### 9.6 Payouts & Settlements
- View all pending CC/CCL payout batches
- Approve or reject individual payouts before transfer
- Trigger manual payout run outside Thursday schedule
- Pause/resume Thursday auto-settlement (global or per-role)
- View transfer status (initiated, processing, paid, failed)
- Mark failed transfers for retry

### 9.7 Reports & Exports
- Funnel metrics (existing)
- Commission report by partner (filterable by date range) — CSV export
- Payout report (all transfers, status, bank reference) — CSV export
- Revenue report (gross vs. net sales, discount impact) — CSV export
- Activity log viewer (actions, entities, timestamps)

### 9.8 Admin Sub-Role Enforcement (to implement)

| Action | SUPER_ADMIN | ADMIN | SUPPORT |
|---|---|---|---|
| All read operations | ✅ | ✅ | ✅ |
| Approve/reject partners | ✅ | ✅ | ❌ |
| Trigger payout | ✅ | ✅ | ❌ |
| Pause settlement | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| Delete data | ✅ | ❌ | ❌ |

Implement via `requireAdminRole(...adminRoles)` middleware in `auth.js`.

---

## 10. Weekly Settlement Automation Design

### 10.1 Cron Setup

```js
// backend/src/services/settlement/settlementCron.js
const cron = require('node-cron');
const { runThursdayBatch } = require('./settlementService');
const logger = require('../../utils/logger');

// Every Thursday at 09:00 IST (UTC+5:30 = 03:30 UTC)
cron.schedule('30 3 * * 4', async () => {
  logger.info('[Settlement] Thursday cron started');
  try {
    const ccResult  = await runThursdayBatch({ targetRole: 'CAREER_COUNSELLOR' });
    const cclResult = await runThursdayBatch({ targetRole: 'CAREER_COUNSELLOR_LEAD' });
    logger.info('[Settlement] Batch complete', { ccResult, cclResult });
  } catch (err) {
    logger.error('[Settlement] Cron failed', { error: err.message });
    // Alert: send email/WhatsApp to SUPER_ADMIN
  }
}, { timezone: 'Asia/Kolkata' });
```

Activate in `server.js`:
```js
if (process.env.ENABLE_SETTLEMENT_CRON === 'true') {
  require('./services/settlement/settlementCron');
}
```

### 10.2 Retry Strategy

| Failure Type | Retry |
|---|---|
| Bank transfer API error (5xx) | Retry up to 3 times with exponential backoff (1h, 4h, 24h) |
| Bank transfer rejected (invalid account) | Mark `status='failed'`, notify partner to update bank details, admin alert |
| Payout row creation failed (DB error) | No debit occurs (atomic transaction); safe to re-run |
| Partner bank account missing | Skip that partner; log + notify admin |

Retry state tracked in `CcPayout.status` / `CclPayout.status`:
```
pending → approved → processing → paid
                  → failed      → manual_retry (admin action)
```

### 10.3 Reconciliation

Weekly reconciliation job (Saturday morning, post-Thursday payouts):
1. Query all payouts in `processing` state older than 24 hours
2. Call `bankTransferService.checkStatus(transferRef)` for each
3. If Razorpay webhook already updated → status is `paid`; mark reconciled
4. If still pending → escalate to admin
5. Generate reconciliation report sent to admin email

### 10.4 Failure Handling

- If ENABLE_SETTLEMENT_CRON is false → admin manually triggers via `/admin/payouts/settle`
- Settlement Pause: check `SettlementSchedule.isPaused` at cron start; abort if paused
- Commission clawback on refund: `payment.refunded` event → `CcAttributedSale.status = "refunded"` → `WalletTransaction(REFUND_REVERSAL)` → reduce `WalletAccount.balancePaise`

---

## 11. Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| Double commission credit on duplicate webhook | `CcAttributedSale.paymentId @unique` + idempotency check at service entry |
| Payout to wrong/old bank account | Always fetch `BankAccount` at transfer time, not at payout creation time |
| Commission credited but bank transfer fails | Wallet debit is inside transfer transaction; if transfer fails, debit is rolled back |
| Partner changes bank details after payout is approved | Lock `bankAccountId` on payout approval; prevent edit after that point |
| CCL discount > 20% submitted | Backend enforces `Math.min(discountPct, MAX_DISCOUNT_PCT)`; Joi validates input |
| Legacy test-link edge cases | Deprecated (test links retired); referral/coupon flow is used |
| Razorpay webhook replayed | Webhook handler checks `razorpayPaymentId` in `CcAttributedSale` before creating |
| AI question generation failure | Fallback chain: GPT-4o → Gemini → static pool → hardcoded default |
| Partner approval pending but tries to create links | Backend `requireApproved` middleware blocks; frontend shows `PendingApproval.jsx` |
| Thursday cron fires twice (server restart) | Payout row has `scheduledFor` index; second run finds existing payout for that Thursday = skip |
| Net sales discrepancy after Razorpay fees | Document clearly: commission is on `netAmountPaise` (after discount, before Razorpay fee). Razorpay fee ~2% is borne by platform |
| GST on counsellor commission (TDS) | Out of scope for now — flag as compliance requirement for Phase 3 (TDS deduction at 10%) |

---

## 12. Step-by-Step Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–3) ← Start here

**Goal:** Bank accounts, wallet ledger, cron, multi-send

| # | Task | File(s) |
|---|---|---|
| 1.1 | Add `BankAccount` model to Prisma schema | `prisma/schema.prisma` |
| 1.2 | Add `WalletAccount` + `WalletTransaction` models | `prisma/schema.prisma` |
| 1.3 | Add `approvalStatus` to `User` model | `prisma/schema.prisma` |
| 1.4 | Migration: `20250120000000_phase7_bank_wallet_approval` | `prisma/migrations/` |
| 1.5 | Implement `walletLedgerService.js` | `services/wallet/walletLedgerService.js` |
| 1.6 | Integrate wallet credit into `createCcSaleAndCommission()` | `services/cc/ccPaymentService.js` |
| 1.7 | Integrate wallet credit into `createCclSaleAndCommission()` | `services/ccl/cclPaymentService.js` |
| 1.8 | Implement `bankTransferService.js` (Razorpay Payout API + stub) | `services/bank/bankTransferService.js` |
| 1.9 | Implement `settlementService.js` | `services/settlement/settlementService.js` |
| 1.10 | Implement `settlementCron.js` + wire in `server.js` | `services/settlement/settlementCron.js` |
| 1.11 | Add bank account API routes + controller | `routes/partner.routes.js`, `controllers/partner.controller.js` |
| 1.12 | Add wallet API endpoints to CC/CCL controllers | `controllers/cc.controller.js`, `ccl.controller.js` |
| 1.13 | Frontend: `BankAccountForm.jsx` | `pages/Partner/BankAccountForm.jsx` |
| 1.14 | Frontend: `WalletAccount.jsx` for CC + CCL | `pages/Counsellor/`, `pages/Staff/` |

### Phase 2 — Partner Registration & Onboarding (Weeks 3–5)

| # | Task | File(s) |
|---|---|---|
| 2.1 | Add `PartnerOnboarding` model to schema | `prisma/schema.prisma` |
| 2.2 | Create `partner.controller.js` — register, me, onboarding | `controllers/partner.controller.js` |
| 2.3 | Create `partner.routes.js` + mount in `index.js` | `routes/partner.routes.js` |
| 2.4 | Add `requireApproved` middleware | `middleware/auth.js` |
| 2.5 | Admin: list/approve/reject partners endpoint | `controllers/admin.controller.js` (extend) |
| 2.6 | Frontend: `PartnerRegister.jsx` | `pages/Partner/PartnerRegister.jsx` |
| 2.7 | Frontend: `PartnerOnboarding.jsx` | `pages/Partner/PartnerOnboarding.jsx` |
| 2.8 | Frontend: `PendingApproval.jsx` | `pages/Partner/PendingApproval.jsx` |
| 2.9 | Frontend: `PartnerManagement.jsx` (admin) | `pages/Admin/PartnerManagement.jsx` |
| 2.10 | Frontend: `PartnerDetail.jsx` (admin) | `pages/Admin/PartnerDetail.jsx` |

### Phase 3 — Multi-Send Flow (Week 5–6)

| # | Task | File(s) |
|---|---|---|
| 3.1 | Add `MultiSendBatch` model | `prisma/schema.prisma` |
| 3.2 | `POST /staff/joining-links/bulk` — create N links | `controllers/ccl.controller.js` |
| 3.3 | Wire `partnerNotificationService.sendLinkToRecipient()` | `services/notification/partnerNotificationService.js` |
| 3.4 | Frontend: `MultiSendModal.jsx` shared component | `components/MultiSendModal.jsx` |
| 3.5 | Wire modal into CCL dashboard | `LeadDashboard.jsx` |

### Phase 4 — Admin Payout UI + Training UI (Weeks 6–8)

| # | Task | File(s) |
|---|---|---|
| 4.1 | Frontend: `PayoutManagement.jsx` | `pages/Admin/PayoutManagement.jsx` |
| 4.2 | Frontend: `CommissionReports.jsx` + CSV export | `pages/Admin/CommissionReports.jsx` |
| 4.3 | Frontend: `TrainingManager.jsx` | `pages/Admin/TrainingManager.jsx` |
| 4.4 | Frontend: `TrainingLibrary.jsx` (CC) | `pages/Counsellor/TrainingLibrary.jsx` |
| 4.5 | Frontend: `TrainingLibrary.jsx` (CCL) | `pages/Staff/TrainingLibrary.jsx` |
| 4.6 | Frontend: `PayoutsScreen.jsx` (CC) | `pages/Counsellor/PayoutsScreen.jsx` |
| 4.7 | Frontend: `PayoutsScreen.jsx` (CCL) | `pages/Staff/PayoutsScreen.jsx` |
| 4.8 | Admin payout approve/reject API | `controllers/cc.admin.controller.js`, `ccl.admin.controller.js` |
| 4.9 | Settlement pause/resume API + `SettlementSchedule` | `controllers/admin.controller.js` |

### Phase 5 — Assessment Rule Engine (Weeks 8–9)

| # | Task | File(s) |
|---|---|---|
| 5.1 | Add `AssessmentRuleTemplate` model | `prisma/schema.prisma` |
| 5.2 | Implement `assessmentRuleEngine.js` | `services/assessment/assessmentRuleEngine.js` |
| 5.3 | Integrate rule engine into `assessment.controller.js` | `controllers/assessment.controller.js` |
| 5.4 | Wire `ParentDetail` data into question prompt | `services/ai/promptTemplates.js` |
| 5.5 | Admin CRUD for rule templates | `controllers/admin.controller.js` + frontend |
| 5.6 | Seed default rule templates | `prisma/seed.js` |

### Phase 6 — Security Hardening & Compliance (Weeks 9–10)

| # | Task | File(s) |
|---|---|---|
| 6.1 | Encrypt `BankAccount.accountNumber` at rest | `controllers/partner.controller.js`, `services/bank/` |
| 6.2 | Enforce `AdminRole` sub-permissions in middleware | `middleware/auth.js` |
| 6.3 | Webhook signature verification (Razorpay Payout webhook) | `routes/payment.routes.js` |
| 6.4 | Rate limits on registration + bulk send endpoints | `middleware/rateLimiter.js` |
| 6.5 | Audit log viewer in admin | `pages/Admin/ActivityLog.jsx` |
| 6.6 | PII masking in API responses (account number → `****1234`) | `controllers/partner.controller.js` |

---

## 13. Files Likely to Change

### Prisma / Database
- `backend/prisma/schema.prisma` — Add 8 new models, 4 field additions
- `backend/prisma/migrations/` — New migration folder per phase
- `backend/prisma/seed.js` — Add seed for `DiscountPolicy`, `AssessmentRuleTemplate`, sample CC/CCL users

### Backend — New Files
- `backend/src/controllers/partner.controller.js`
- `backend/src/routes/partner.routes.js`
- `backend/src/services/bank/bankTransferService.js`
- `backend/src/services/settlement/settlementService.js`
- `backend/src/services/settlement/settlementCron.js`
- `backend/src/services/wallet/walletLedgerService.js`
- `backend/src/services/notification/partnerNotificationService.js`
- `backend/src/services/assessment/assessmentRuleEngine.js`

### Backend — Modified Files
- `backend/src/server.js` — mount cron, new routes
- `backend/src/routes/index.js` — add `/partner` route
- `backend/src/middleware/auth.js` — add `requireApproved`, `requireAdminRole`
- `backend/src/controllers/admin.controller.js` — extend with partner management, payout, settlement
- `backend/src/controllers/cc.controller.js` — add bulk send, wallet endpoint
- `backend/src/controllers/ccl.controller.js` — add bulk send, wallet endpoint
- `backend/src/controllers/cc.admin.controller.js` — add approve/reject payout, settlement pause
- `backend/src/controllers/ccl.admin.controller.js` — same
- `backend/src/controllers/assessment.controller.js` — integrate rule engine, parent data
- `backend/src/services/cc/ccPaymentService.js` — add wallet credit call
- `backend/src/services/ccl/cclPaymentService.js` — add wallet credit call
- `backend/src/services/ai/promptTemplates.js` — add parent context, rule-engine category

### Frontend — New Files
- `frontend/src/pages/Partner/PartnerRegister.jsx`
- `frontend/src/pages/Partner/PartnerOnboarding.jsx`
- `frontend/src/pages/Partner/PendingApproval.jsx`
- `frontend/src/pages/Partner/BankAccountForm.jsx`
- `frontend/src/pages/Counsellor/TrainingLibrary.jsx`
- `frontend/src/pages/Counsellor/WalletAccount.jsx`
- `frontend/src/pages/Counsellor/PayoutsScreen.jsx`
- `frontend/src/pages/Staff/TrainingLibrary.jsx`
- `frontend/src/pages/Staff/WalletAccount.jsx`
- `frontend/src/pages/Staff/PayoutsScreen.jsx`
- `frontend/src/pages/Admin/PartnerManagement.jsx`
- `frontend/src/pages/Admin/PartnerDetail.jsx`
- `frontend/src/pages/Admin/PayoutManagement.jsx`
- `frontend/src/pages/Admin/TrainingManager.jsx`
- `frontend/src/pages/Admin/DiscountPolicyManager.jsx`
- `frontend/src/pages/Admin/CommissionReports.jsx`
- `frontend/src/components/MultiSendModal.jsx`
- `frontend/src/components/DiscountControl.jsx`

### Frontend — Modified Files
- `frontend/src/App.jsx` — add all new routes
- `frontend/src/pages/Counsellor/CounsellorDashboard.jsx` — add multi-send button, training nav tab
- `frontend/src/pages/Staff/LeadDashboard.jsx` — same
- `frontend/src/pages/Admin/AdminDashboard.jsx` — add nav links to new admin pages
- `frontend/src/services/api.js` — add partner API client, admin payout/partner API

---

## 14. MVP vs Phase 2 Scope

### MVP (Must Go Live Before Onboarding Partners)

| # | Feature | Rationale |
|---|---|---|
| M1 | Bank account model + API | Partners need to submit bank details before any payout can happen |
| M2 | Wallet ledger (WalletAccount + WalletTransaction) | Commission balance must be real-time and traceable |
| M3 | Settlement service + Thursday cron | Core business requirement; without it payouts are manual |
| M4 | Partner registration flow (self-service) | Partners can't onboard without this |
| M5 | Admin partner approval/reject UI | No gate = any account can operate as CC/CCL |
| M6 | `requireApproved` middleware | Security: blocks unapproved partners from creating links |
| M7 | BankAccountForm (frontend) | Partners must submit bank details via UI |
| M8 | WalletAccount screen (frontend) | Partners must see real-time balance |
| M9 | PayoutsScreen (frontend) | Partners must see payout status |
| M10 | Bank transfer service (stub initially, Razorpay Payout later) | Enables payout flow even if real transfers are manual first |
| M11 | Admin payout management UI | Admin needs to approve/trigger payouts |
| M12 | WhatsApp notification: payout initiated | Partner must know when transfer happens |
| M13 | Net sales separately displayed | Fix misleading dashboard — show gross vs net clearly |
| M14 | Training library frontend (CC + CCL) | Currently a PARTIAL gap; core portal promise |

### Phase 2 (Next Sprint After MVP Stable)

| # | Feature | Rationale |
|---|---|---|
| P2-1 | Multi-send modal (bulk link creation) | Convenience; single-send covers core need in MVP |
| P2-2 | Assessment rule engine | Improves quality; AI-only generation works for MVP |
| P2-3 | Parent input in assessment prompt | Enhancement over existing behavior |
| P2-4 | Admin sub-role enforcement (SUPPORT restrictions) | Security improvement; single ADMIN is OK for MVP |
| P2-5 | Settlement pause/resume controls | Risk control; manual workaround is possible |
| P2-6 | Commission CSV exports | Reporting; downloadable manually for MVP |
| P2-7 | Razorpay Payout API integration | Automate transfers; stub/manual OK for MVP launch |
| P2-8 | Commission dispute model + workflow | Edge case; manual email OK for MVP |
| P2-9 | Reconciliation Saturday cron job | Adds reliability; manual check OK initially |
| P2-10 | User activate/deactivate API + admin UI | Admin can delete user as workaround |
| P2-11 | Admin activity log viewer | Audit trail exists in DB; UI is a convenience |
| P2-12 | TDS/GST compliance for commissions | Regulatory; consult CA before Phase 3 |

---

*End of Implementation Plan — CAD Gurukul, April 2026*
