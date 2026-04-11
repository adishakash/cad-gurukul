# CAD Gurukul – API Reference

**Base URL:** `/api/v1`
**Authentication:** `Authorization: Bearer <access_token>`
**Content-Type:** `application/json`

---

## Auth Endpoints

| Method | Endpoint                  | Auth | Description         |
|--------|---------------------------|------|---------------------|
| POST   | /auth/register            | No   | Student registration |
| POST   | /auth/login               | No   | Login (returns JWT) |
| POST   | /auth/refresh             | No   | Refresh access token |
| POST   | /auth/logout              | Yes  | Invalidate token    |
| POST   | /auth/forgot-password     | No   | Send reset email    |
| POST   | /auth/reset-password      | No   | Reset with token    |

---

## Student Endpoints

| Method | Endpoint                  | Auth | Description              |
|--------|---------------------------|------|--------------------------|
| GET    | /students/me              | Yes  | Get own profile          |
| PUT    | /students/me              | Yes  | Update profile           |
| POST   | /students/me/onboarding   | Yes  | Submit onboarding form   |

---

## Assessment Endpoints

| Method | Endpoint                         | Auth | Description                    |
|--------|----------------------------------|------|--------------------------------|
| POST   | /assessments/start               | Yes  | Start new assessment session   |
| GET    | /assessments/:id                 | Yes  | Get assessment status          |
| POST   | /assessments/:id/questions/next  | Yes  | Get next AI question           |
| POST   | /assessments/:id/answers         | Yes  | Submit answer                  |
| POST   | /assessments/:id/complete        | Yes  | Complete assessment session    |

---

## Report Endpoints

| Method | Endpoint                  | Auth | Description              |
|--------|---------------------------|------|--------------------------|
| GET    | /reports/:id              | Yes  | Get report (free/paid)   |
| GET    | /reports/:id/pdf          | Yes  | Download PDF (paid only) |
| GET    | /reports/my               | Yes  | List student's reports   |

---

## Payment Endpoints

| Method | Endpoint                     | Auth | Description            |
|--------|------------------------------|------|------------------------|
| POST   | /payments/create-order       | Yes  | Create Razorpay order  |
| POST   | /payments/verify             | Yes  | Verify payment         |
| GET    | /payments/history            | Yes  | Payment history        |

---

## Admin Endpoints (requires admin role)

| Method | Endpoint                     | Auth  | Description            |
|--------|------------------------------|-------|------------------------|
| GET    | /admin/users                 | Admin | List all users         |
| GET    | /admin/assessments           | Admin | All assessments        |
| GET    | /admin/reports               | Admin | All reports            |
| GET    | /admin/payments              | Admin | All payments           |
| GET    | /admin/analytics             | Admin | Platform analytics     |
| PUT    | /admin/pricing               | Admin | Update pricing plans   |
| GET    | /admin/ai-usage              | Admin | AI API usage stats     |
| GET    | /admin/export/leads          | Admin | Export leads CSV       |
| GET    | /admin/export/payments       | Admin | Export payments CSV    |

---

## Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": []
  }
}
```

---

## HTTP Status Codes

| Code | Meaning               |
|------|-----------------------|
| 200  | OK                    |
| 201  | Created               |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 422  | Validation Error      |
| 429  | Rate Limited          |
| 500  | Internal Server Error |
