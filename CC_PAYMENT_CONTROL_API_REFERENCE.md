# CC Payment Control - API Quick Reference

## Base URL
```
http://localhost:5000/api/v1/admin
```

## Authentication
All endpoints require:
- Header: `Authorization: Bearer {SUPER_ADMIN_TOKEN}`
- Content-Type: `application/json`
- Admin must have `SUPER_ADMIN` role

---

## 1. Pause/Resume CC Payments

### Endpoint
```
PUT /cc/users/:id/pause-payments
```

### Pause Payments
```bash
curl -X PUT \
  http://localhost:5000/api/v1/admin/cc/users/user_abc123/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paused": true,
    "reason": "Pending KYC verification"
  }'
```

### Response (Success)
```json
{
  "status": "success",
  "data": {
    "id": "user_abc123",
    "name": "John Counsellor",
    "email": "john@cc.com",
    "ccPaymentsPaused": true,
    "paymentsPausedAt": "2026-05-17T10:30:00Z"
  },
  "message": "Automatic payments paused for John Counsellor. Use manual payout endpoint."
}
```

### Resume Payments
```bash
curl -X PUT \
  http://localhost:5000/api/v1/admin/cc/users/user_abc123/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paused": false
  }'
```

### Response (Success)
```json
{
  "status": "success",
  "data": {
    "id": "user_abc123",
    "name": "John Counsellor",
    "email": "john@cc.com",
    "ccPaymentsPaused": false,
    "paymentsPausedAt": null
  },
  "message": "Automatic payments resumed for John Counsellor. Will be included in next batch."
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | path | Yes | CC user ID |
| paused | boolean | Yes | true=pause, false=resume |
| reason | string | No | Reason for pause (logged internally) |

### Errors
| Code | Meaning |
|------|---------|
| 400 | Invalid input (paused not boolean) |
| 404 | CC user not found |
| 422 | User is not a Career Counsellor |
| 403 | Not SUPER_ADMIN role |
| 500 | Server error |

---

## 2. Manually Add Payout

### Endpoint
```
POST /cc/payouts/manual-add
```

### Basic Usage
```bash
curl -X POST \
  http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ccUserId": "user_abc123",
    "amountPaise": 500000,
    "reason": "Correction for April commission"
  }'
```

### Response (Success)
```json
{
  "status": "success",
  "data": {
    "payoutId": "payout_xyz789",
    "ccName": "John Counsellor",
    "ccUserId": "user_abc123",
    "amountPaise": 500000,
    "status": "pending",
    "scheduledFor": "2026-05-23T00:00:00Z"
  },
  "message": "Manual payout created for John Counsellor: ₹5000.00"
}
```

### With Custom Schedule
```bash
curl -X POST \
  http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ccUserId": "user_abc123",
    "amountPaise": 1000000,
    "reason": "Special bonus for Q2 performance",
    "scheduledFor": "2026-05-30T00:00:00Z"
  }'
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| ccUserId | string | Yes | Career Counsellor user ID |
| amountPaise | number | Yes | Amount in paise (₹X.XX = X × 100 paise) |
| reason | string | No | Reason for payout (logged in notes) |
| scheduledFor | ISO date | No | Scheduled date (defaults to next Thursday) |

### Amount Examples
```
₹100.00  = 10000 paise
₹500.00  = 50000 paise
₹1000.00 = 100000 paise
₹5000.00 = 500000 paise
₹10000.00= 1000000 paise
```

### Errors
| Code | Meaning |
|------|---------|
| 400 | Invalid input (missing required fields or amountPaise <= 0) |
| 404 | CC user not found |
| 422 | User is not a Career Counsellor |
| 403 | Not SUPER_ADMIN role |
| 500 | Server error |

---

## 3. Generate Payout Batch (Updated)

### Endpoint
```
POST /cc/payouts/generate
```

### Usage
```bash
curl -X POST \
  http://localhost:5000/api/v1/admin/cc/payouts/generate \
  -H "Authorization: Bearer $TOKEN"
```

### Response (Success)
```json
{
  "status": "success",
  "data": {
    "payoutsCreated": 5,
    "skippedCCs": 2,
    "scheduledFor": "2026-05-23T00:00:00Z",
    "payouts": [
      {
        "payoutId": "payout_123",
        "ccName": "John Counsellor",
        "ccUserId": "user_abc123",
        "amountPaise": 750000,
        "count": 3
      },
      {
        "payoutId": "payout_124",
        "ccName": "Jane Counsellor",
        "ccUserId": "user_def456",
        "amountPaise": 920000,
        "count": 4
      }
    ]
  },
  "message": "Payout batch generated: 5 CC(s). 2 CC(s) paused."
}
```

### Behavior
- ✅ Processes all pending commissions
- ❌ Skips CCs with `ccPaymentsPaused = true`
- Groups by CC
- Schedules for next Thursday (4 AM UTC)
- Idempotent (safe to call multiple times)

---

## Common Workflows

### Scenario 1: Handle CC Under Investigation
```bash
# Step 1: Pause payments
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/user_123/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paused": true, "reason": "Under investigation"}'

# Step 2: Perform checks...

# Step 3: Resume payments
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/user_123/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paused": false}'
```

### Scenario 2: Correct Historical Commission
```bash
# Manual payout for April correction
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ccUserId": "user_456",
    "amountPaise": 250000,
    "reason": "April 2025 calculation error - ref S123456"
  }'
```

### Scenario 3: Provide Advance to Paused CC
```bash
# Pause automatic payments
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/user_789/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paused": true}'

# Manual payout as advance (monthly)
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ccUserId": "user_789",
    "amountPaise": 200000,
    "reason": "Monthly advance while on pause"
  }'
```

---

## Response Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | Success (for GET, PUT, PATCH) |
| 201 | Created | Success (for POST) |
| 400 | Bad Request | Invalid input |
| 403 | Forbidden | Not authorized (not SUPER_ADMIN) |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Invalid state transition |
| 422 | Unprocessable | Invalid target type |
| 500 | Server Error | Database or server error |

---

## Error Examples

### Missing Required Field
```json
{
  "status": "error",
  "message": "ccUserId is required and must be a string",
  "code": "VALIDATION_ERROR"
}
```

### Invalid Amount
```json
{
  "status": "error",
  "message": "amountPaise must be a positive number",
  "code": "VALIDATION_ERROR"
}
```

### User Not Found
```json
{
  "status": "error",
  "message": "CC user not found",
  "code": "NOT_FOUND"
}
```

### Insufficient Permissions
```json
{
  "status": "error",
  "message": "Super admin access required",
  "code": "FORBIDDEN"
}
```

---

## Testing with JavaScript

### Using Fetch API
```javascript
// Pause payments
const response = await fetch(
  'http://localhost:5000/api/v1/admin/cc/users/user_123/pause-payments',
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paused: true,
      reason: 'Test pause'
    })
  }
);

const result = await response.json();
console.log(result);
```

### Using Axios
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1/admin',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Pause
await api.put('/cc/users/user_123/pause-payments', {
  paused: true,
  reason: 'Test'
});

// Manual payout
await api.post('/cc/payouts/manual-add', {
  ccUserId: 'user_123',
  amountPaise: 500000,
  reason: 'Test payout'
});

// Generate batch
await api.post('/cc/payouts/generate');
```

---

## Troubleshooting

### "Super admin access required"
- Verify token is for SUPER_ADMIN account
- Check Authorization header format: `Bearer {token}`

### "CC user not found"
- Verify ccUserId/id is correct
- Check user exists in database
- Verify user is CAREER_COUNSELLOR role

### "amountPaise must be a positive number"
- Amount must be > 0
- Use paise (₹5 = 500 paise)
- Check for negative values

### Payout not scheduled correctly
- scheduledFor must be ISO date format
- Time is UTC, defaults to midnight
- Example: "2026-05-23T00:00:00Z"

---

## Rate Limiting
Inherits from admin routes (standard rate limiting applies)

## Logging
All operations logged in application logs:
```
[Admin.CC] CC payment pause toggled
[Admin.CC] Manual payout created
```

Check logs for audit trail of all payment control actions.
