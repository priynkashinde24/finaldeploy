# Local Development Login Fix

## ✅ Fixed: Auto-Approval in Development Mode

The login issue has been fixed! Now:

1. **New registrations** are automatically approved in development mode
2. **Existing users** can login even if pending (in development only)
3. **Production** still requires admin approval (security maintained)

## 🚀 Quick Fix for Existing Users

If you have an existing user that's stuck in "pending" status, you have 3 options:

### Option 1: Use the Approval Script (Recommended)

```bash
cd api
npx ts-node scripts/approve-user.ts your-email@example.com
```

This will:
- Find the user by email
- Set `approvalStatus` to `approved`
- Set `isActive` to `true`
- Allow them to login immediately

### Option 2: Approve via MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Go to `users` collection
4. Find your user by email
5. Update the document:
   ```json
   {
     "approvalStatus": "approved",
     "isActive": true,
     "approvedAt": new Date()
   }
   ```

### Option 3: Register as Admin

Register a new user with role `admin` - admins are auto-approved:

```bash
# Via API
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "password123",
    "role": "admin"
  }'
```

Then login with admin account and approve other users via admin panel.

## 🔧 What Changed

### Registration (`register()` function)
- **Development**: All users auto-approved
- **Production**: Only admins auto-approved, others need admin approval

### Login (`login()` function)
- **Development**: Allows login even if account is pending
- **Production**: Blocks login if account is pending (security)

## 🧪 Testing

1. **Register a new user**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "password": "password123",
       "role": "reseller"
     }'
   ```

2. **Login immediately** (should work now):
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123"
     }'
   ```

3. **Check user status**:
   - Should have `approvalStatus: "approved"` (in development)
   - Should have `isActive: true` (in development)

## 📝 Environment Variables

Make sure you have `NODE_ENV` set correctly:

**For Development** (auto-approval enabled):
```env
NODE_ENV=development
# or
NODE_ENV=dev
# or just don't set it (defaults to development)
```

**For Production** (admin approval required):
```env
NODE_ENV=production
```

## ✅ Verification

After fixing, you should be able to:
- ✅ Register new users
- ✅ Login immediately (in development)
- ✅ No more "Account pending admin approval" errors (in development)

## 🔒 Production Behavior

In production (`NODE_ENV=production`):
- ✅ Security is maintained
- ✅ Only admins are auto-approved
- ✅ Other users require admin approval
- ✅ Login is blocked until approved

---

**The fix is already applied!** Just restart your backend server and try logging in again.

