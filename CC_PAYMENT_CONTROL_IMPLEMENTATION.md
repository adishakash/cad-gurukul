# CC Payment Control Feature - Implementation Summary

## Feature Description
Added the ability for super admins to:
1. **Pause automatic payments** for specific Career Counsellors
2. **Manually add payouts** directly without waiting for commissions
3. **Resume automatic payments** when ready

## Changes Made

### 1. Database Schema
**File:** `backend/prisma/schema.prisma`

Added three fields to `User` model:
```prisma
ccPaymentsPaused   Boolean             @default(false)
paymentsPausedAt   DateTime?
pausedBy           String? // adminUser.id who paused
```

### 2. Database Migration
**File:** `backend/prisma/migrations/20260517_add_cc_payment_pause_control/migration.sql`

Creates migration with:
- Three new columns in `users` table
- Index on `ccPaymentsPaused` for query performance

### 3. Controller Updates
**File:** `backend/src/controllers/cc.admin.controller.js`

**Modified Function:**
- `generatePayoutBatch()` - Now skips CCs with `ccPaymentsPaused = true`

**New Functions:**
- `toggleCCPaymentsPause()` - Enable/disable payment pause for a CC
- `manuallyAddCCPayout()` - Create manual payout for any amount

### 4. Route Updates
**File:** `backend/src/routes/admin.routes.js`

**New Routes:**
- `PUT /api/v1/admin/cc/users/:id/pause-payments` (SUPER_ADMIN)
- `POST /api/v1/admin/cc/payouts/manual-add` (SUPER_ADMIN)

**Updated Imports:**
- Added `requireSuperAdmin` middleware to enforce role-based access

---

## API Endpoints

### Pause/Resume Payments
```
PUT /api/v1/admin/cc/users/:id/pause-payments
```
- **Auth:** SUPER_ADMIN only
- **Body:** `{ paused: boolean, reason?: string }`
- **Returns:** Updated user with pause status

### Manual Payout Creation
```
POST /api/v1/admin/cc/payouts/manual-add
```
- **Auth:** SUPER_ADMIN only
- **Body:** `{ ccUserId: string, amountPaise: number, reason?: string, scheduledFor?: date }`
- **Returns:** Created payout details

---

## Key Features

✅ **Pause Control**
- Toggle automatic payment inclusion in batch generation
- Paused CCs skipped during automatic payout batching
- Track who paused and when

✅ **Manual Payouts**
- Create payouts directly without commission dependency
- Supports any amount (not tied to commissions)
- Custom scheduling or default to next Thursday
- Full audit trail

✅ **Backward Compatible**
- No changes to existing payout workflow
- Manual payouts treated like auto-generated ones
- Resume is as simple as pause

✅ **Secure**
- SUPER_ADMIN role required for both operations
- All actions logged with admin user ID
- Input validation on amounts and users

✅ **Flexible**
- Reason field for documentation
- Custom scheduling for manual payouts
- Works for any edge case

---

## Usage Flow

### Scenario 1: Pause Due to Verification
```
1. Admin: PUT /pause-payments (paused=true)
   → CC's payments paused, stopped from auto-batching
2. Admin processes: Manual reviews, document checks, etc.
3. Admin: PUT /pause-payments (paused=false)
   → CC's payments resumed, included in next batch
```

### Scenario 2: Commission Correction
```
1. Admin: POST /manual-add
   → Create direct payout with custom amount
2. Payout processed through standard workflow
3. CC receives corrected amount
```

### Scenario 3: Special Handling
```
1. Admin: POST /manual-add (for paused CC)
   → Create payout manually instead of waiting for batch
2. Payout processed immediately (or on schedule)
3. No impact on commission batching
```

---

## Testing

### Manual Testing
```bash
# Pause payments
curl -X PUT http://localhost:5000/api/v1/admin/cc/users/{ccUserId}/pause-payments \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"paused": true}'

# Create manual payout
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/manual-add \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ccUserId": "user_123",
    "amountPaise": 500000,
    "reason": "Correction"
  }'

# Generate batch (will skip paused CCs)
curl -X POST http://localhost:5000/api/v1/admin/cc/payouts/generate \
  -H "Authorization: Bearer $TOKEN"
```

### Database Verification
```sql
-- Check paused CCs
SELECT id, name, email, ccPaymentsPaused, paymentsPausedAt
FROM users
WHERE ccPaymentsPaused = true;

-- Check manual payouts
SELECT * FROM cc_payouts
WHERE notes LIKE 'Manual payout%'
ORDER BY createdAt DESC;
```

---

## Logging
All operations logged with:
- Action type (pause/resume/manual payout)
- CC user ID
- Admin ID
- Timestamp
- Reason (if provided)

Example log entries:
```
[Admin.CC] CC payment pause toggled
  ccUserId: cc_user_123
  paused: true
  reason: "Pending verification"
  adminId: admin_xyz

[Admin.CC] Manual payout created
  payoutId: payout_123
  ccUserId: cc_user_123
  amountPaise: 500000
  adminId: admin_xyz
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Added 3 fields to User model |
| `backend/prisma/migrations/20260517_*` | Migration for new columns |
| `backend/src/controllers/cc.admin.controller.js` | Updated generatePayoutBatch, added 2 functions |
| `backend/src/routes/admin.routes.js` | Added 2 routes with SUPER_ADMIN protection |

---

## Documentation
- **Complete Documentation:** `CC_PAYMENT_PAUSE_FEATURE.md`
- **Implementation Notes:** This file

---

## Next Steps

1. **Run Migration**
   ```bash
   npx prisma migrate deploy
   ```

2. **Restart Backend**
   ```bash
   npm run dev
   ```

3. **Test Endpoints**
   - Use provided test commands above
   - Verify pause/resume works
   - Verify manual payouts created correctly

4. **Monitor Logs**
   - Check admin logs for payment control actions
   - Verify audit trail is being recorded

---

## Rollback (if needed)

```bash
# Revert migration
npx prisma migrate resolve --rolled-back 20260517_add_cc_payment_pause_control

# Restore controller
git checkout HEAD^ backend/src/controllers/cc.admin.controller.js

# Restore routes
git checkout HEAD^ backend/src/routes/admin.routes.js
```

---

## Security Checklist

✅ SUPER_ADMIN role required for both endpoints
✅ Input validation on amounts (must be > 0)
✅ User role validation (must be CC)
✅ Audit trail with admin ID
✅ Rate limiting inherited from admin routes
✅ HTTPS enforced in production
✅ No sensitive data in response beyond what needed
