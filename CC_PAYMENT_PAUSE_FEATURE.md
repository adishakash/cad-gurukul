# CC Payment Control Feature

## Overview
This feature allows super admins to pause automatic payment generation for Career Counsellors (CCs) and manually create payouts instead. This is useful for handling exceptional cases, payment holds, or special arrangements.

## Database Changes

### Schema Updates
Added three new fields to the `User` model:
- `ccPaymentsPaused` (Boolean, default: false) - Flag to pause automatic payouts
- `paymentsPausedAt` (DateTime, nullable) - Timestamp when payments were paused
- `pausedBy` (String, nullable) - Admin user ID who initiated the pause

```prisma
model User {
  // ... existing fields ...
  ccPaymentsPaused   Boolean             @default(false)
  paymentsPausedAt   DateTime?
  pausedBy           String? // adminUser.id who paused
  // ... rest of fields ...
}
```

### Migration
File: `backend/prisma/migrations/20260517_add_cc_payment_pause_control/migration.sql`
- Adds three columns to `users` table
- Creates index on `ccPaymentsPaused` for performance

## API Endpoints

### 1. Toggle Payment Pause
**Endpoint:** `PUT /api/v1/admin/cc/users/:id/pause-payments`

**Auth Required:** SUPER_ADMIN only

**Request Body:**
```json
{
  "paused": true,
  "reason": "Pending verification documents"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "data": {
    "id": "user_123",
    "name": "John Counsellor",
    "email": "john@cc.com",
    "ccPaymentsPaused": true,
    "paymentsPausedAt": "2026-05-17T10:30:00Z"
  },
  "message": "Automatic payments paused for John Counsellor. Use manual payout endpoint."
}
```

**Parameters:**
- `id` (path) - CC user ID
- `paused` (body, required) - Boolean to pause (true) or resume (false)
- `reason` (body, optional) - Reason for pause (for internal logging)

**Use Cases:**
- Pause payments for a CC under investigation
- Hold payments pending document verification
- Temporarily suspend payouts due to compliance issues
- Resume automatic payments after issue resolution

---

### 2. Manually Add Payout
**Endpoint:** `POST /api/v1/admin/cc/payouts/manual-add`

**Auth Required:** SUPER_ADMIN only

**Request Body:**
```json
{
  "ccUserId": "user_123",
  "amountPaise": 500000,
  "reason": "Adjustment for missed commission - June period",
  "scheduledFor": "2026-05-23T00:00:00Z"
}
```

**Response (Success):**
```json
{
  "status": "success",
  "data": {
    "payoutId": "payout_xyz",
    "ccName": "John Counsellor",
    "ccUserId": "user_123",
    "amountPaise": 500000,
    "status": "pending",
    "scheduledFor": "2026-05-23T00:00:00Z"
  },
  "message": "Manual payout created for John Counsellor: ₹5000.00"
}
```

**Parameters:**
- `ccUserId` (body, required) - CC user ID receiving the payout
- `amountPaise` (body, required) - Amount in paise (must be > 0)
- `reason` (body, optional) - Reason for manual payout (logged in notes)
- `scheduledFor` (body, optional) - ISO date for scheduled date (defaults to next Thursday)

**Features:**
- Creates payout directly without waiting for commissions
- Payout starts in "pending" status like normal payouts
- Can be processed through standard payout workflow
- Amount can be any value (manual override)

**Use Cases:**
- Adjust for historical commission corrections
- Provide advances or special bonuses
- Make up missed payouts
- Handle edge cases not covered by commission system

---

### 3. Generate Payout Batch (Updated)
**Endpoint:** `POST /api/v1/admin/cc/payouts/generate`

**Changes:**
- Now skips CCs with `ccPaymentsPaused = true`
- Returns information about skipped CCs

**Response (Updated):**
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
        "ccUserId": "user_123",
        "amountPaise": 750000,
        "count": 3
      }
      // ... more payouts ...
    ]
  },
  "message": "Payout batch generated: 5 CC(s). 2 CC(s) paused."
}
```

**Behavior:**
- Processes all pending commissions EXCEPT those from paused CCs
- Paused CCs' commissions remain in "pending" status
- Admin must use manual payout endpoint for paused CCs
- Safe to call multiple times (idempotent)

---

## Workflow Examples

### Example 1: Pause & Resume Payments
```bash
# Pause payments for CC due to verification
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/cc_user_123/pause-payments \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paused": true,
    "reason": "Pending KYC verification"
  }'

# ... handle verification ...

# Resume automatic payments
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/cc_user_123/pause-payments \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paused": false
  }'
```

### Example 2: Manual Payout for Paused CC
```bash
# CC has paused automatic payments
# Manually add payout for June earnings
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ccUserId": "cc_user_123",
    "amountPaise": 1500000,
    "reason": "June commission - manual processing due to paused status",
    "scheduledFor": "2026-05-23T00:00:00Z"
  }'
```

### Example 3: Commission Correction
```bash
# CC had a historical commission error
# Use manual payout to correct
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ccUserId": "cc_user_456",
    "amountPaise": 250000,
    "reason": "Correction for April 2025 calculation error - sale ref S123456"
  }'
```

---

## Implementation Details

### Logging
All payment pause/resume and manual payout actions are logged:

```javascript
// Pause action
logger.info('[Admin.CC] CC payment pause toggled', {
  ccUserId: 'cc_user_123',
  paused: true,
  reason: 'Pending verification',
  adminId: 'admin_xyz'
});

// Manual payout
logger.info('[Admin.CC] Manual payout created', {
  payoutId: 'payout_123',
  ccUserId: 'cc_user_123',
  amountPaise: 1500000,
  reason: 'June commission',
  adminId: 'admin_xyz'
});
```

### Error Handling
- User not found: 404
- User is not a CC: 422
- Invalid pause status: 400
- Invalid amount: 400
- Database error: 500

---

## Security Considerations

1. **SUPER_ADMIN only**: Both endpoints require super admin role
2. **Audit trail**: All actions logged with admin ID
3. **Soft controls**: Pause is not permanent, can be resumed
4. **No double-payment**: Manual payouts don't affect commission batching
5. **Immutable records**: All payouts (manual or auto) tracked in database

---

## Database Queries

### Find Paused CCs
```sql
SELECT id, name, email, ccPaymentsPaused, paymentsPausedAt, pausedBy
FROM users
WHERE ccPaymentsPaused = true AND role = 'CAREER_COUNSELLOR';
```

### Check Pending Commissions for Paused CC
```sql
SELECT cc.*, ca.grossAmountPaise, ca.netAmountPaise
FROM cc_commissions cc
JOIN cc_attributed_sales ca ON cc.attributedSaleId = ca.id
WHERE cc.ccUserId = 'user_123' AND cc.status = 'pending' AND cc.payoutId IS NULL;
```

### View Manual Payouts
```sql
SELECT *
FROM cc_payouts
WHERE notes LIKE 'Manual payout%'
ORDER BY createdAt DESC;
```

---

## Testing

### Test Pause/Resume
```bash
# Test pause
node -e "
const prisma = require('./backend/src/config/database');
(async () => {
  const user = await prisma.user.update({
    where: { id: 'cc_user_test' },
    data: { ccPaymentsPaused: true, paymentsPausedAt: new Date() },
    select: { ccPaymentsPaused: true, paymentsPausedAt: true }
  });
  console.log('Paused:', user);
})();
"
```

### Test Manual Payout
```bash
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ccUserId": "cc_user_test",
    "amountPaise": 100000,
    "reason": "Test payout"
  }'
```

---

## Related Documentation
- [CC Business Layer](../docs/implementation-plan.md#cc-business-layer-phase-5)
- [Payout Management](./cc-admin.controller.js)
- [User Model](./prisma/schema.prisma)
- [Admin Routes](./routes/admin.routes.js)
