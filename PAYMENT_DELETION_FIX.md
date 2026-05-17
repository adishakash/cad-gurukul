# Payment Deletion Fix: Student Account Removal

## Issue
When a student account was deleted, payment records and purchase history remained attached to that email address. Upon re-registration with the same email, old payment records would still be visible, causing confusion and potential data integrity issues.

## Root Cause
The account deletion logic was not properly ordered to handle all dependencies between tables:
- Payments referenced CareerReports (via reportId FK)
- ReportDownloads referenced both CareerReports and Users
- Leads had paymentId references (string, not FK) that could orphan records
- The email uniqueness constraint was not consistently enforced during re-registration

## Solution Implemented

### 1. **Enhanced accountDeletion.js** 
Updated [backend/src/utils/accountDeletion.js](backend/src/utils/accountDeletion.js) with proper deletion ordering:

**Deletion Phases (in order):**
1. **Phase 1**: Delete all payments first (prevents orphaned payment records)
2. **Phase 2**: Delete report downloads and career reports (removes payment dependencies)
3. **Phase 3**: Delete assessments (removes other user data)
4. **Phase 4**: Delete consultation bookings
5. **Phase 5**: Delete user profiles (StudentProfile, ParentDetail)
6. **Phase 6**: Delete tokens and sessions (refresh tokens, verification tokens, etc.)
7. **Phase 7**: Delete activity logs (analytics, WhatsApp messages)
8. **Phase 8**: Delete all leads (especially those with orphaned paymentId references)

### 2. **Why This Order Matters**
```
Foreign Key Dependencies:
  Payment.reportId → CareerReport.id
  ReportDownload.reportId → CareerReport.id
  ReportDownload.userId → User.id
  CareerReport.assessmentId → Assessment.id
  Lead.paymentId → (string reference, not FK)

Deletion Order:
  ✓ Delete payments BEFORE reports (breaks FK dependency)
  ✓ Delete reportDownloads BEFORE reports (breaks FK dependency)
  ✓ Delete reports BEFORE assessments (breaks FK dependency)
  ✓ Delete leads last (cleans up all paymentId references)
```

### 3. **Email Anonymization**
The student deletion process (both user-initiated and admin-initiated) now:
1. Purges all user data using `purgeUserData()`
2. Anonymizes the email to `deleted_{userId}@deleted.cadgurukul.internal`
3. Marks user as soft-deleted (deletedAt timestamp)
4. Allows the original email to be reused for new registrations

### 4. **Verification**
A verification script has been added: [verify_payment_deletion.js](verify_payment_deletion.js)

Run to test:
```bash
node verify_payment_deletion.js
```

This script:
- Creates a test student account with payments
- Deletes the account using the purge logic
- Creates a new account with the same email
- Verifies that the new account has no old payment records

## Files Modified
1. **[backend/src/utils/accountDeletion.js](backend/src/utils/accountDeletion.js)**
   - Enhanced `purgeUserData()` function with proper deletion ordering
   - Added detailed documentation for each deletion phase

2. **[verify_payment_deletion.js](verify_payment_deletion.js)** (NEW)
   - Comprehensive verification script to test the fix

## Testing
The fix has been implemented in both deletion paths:
1. **User-initiated**: `POST /api/v1/auth/delete-account` (auth.controller.js)
2. **Admin-initiated**: `DELETE /api/v1/admin/users/:id` (admin.controller.js)

Both paths now use the enhanced `purgeUserData()` function within database transactions.

## Verification Checklist
- [x] Payments are explicitly deleted when user is deleted
- [x] CareerReports are deleted before assessments
- [x] ReportDownloads are deleted before reports
- [x] All leads with user's email are resolved and deleted
- [x] User email is anonymized to allow re-registration
- [x] Transaction integrity is maintained
- [x] New users with same email can register without seeing old payments

## Future Considerations
1. **Hard Delete Option**: Consider adding a secure hard-delete endpoint for GDPR compliance
2. **Audit Trail**: Payment deletion is logged in the database, not in separate audit logs
3. **Cascade Deletes**: Payment model has `onDelete: Cascade` on User FK, but explicit deletion is safer
4. **Lead Uniqueness**: Consider enforcing referential integrity on Lead.paymentId if it becomes a FK

## Related Documentation
- [User Deletion Flow](../../docs/deployment.md#user-management)
- [Database Schema](../../prisma/schema.prisma)
- [Auth Controller](backend/src/controllers/auth.controller.js#deleteAccount)
- [Admin Controller](backend/src/controllers/admin.controller.js#deleteUser)
