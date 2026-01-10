# Quick Fix: "Please verify your email to continue" Error

## ✅ Fixed: Auto-Verify Email in Development Mode

The login function now **auto-verifies emails during login in development mode**.

### What Changed

- **Development Mode**: Email is automatically verified when you login
- **Production Mode**: Still requires email verification (security maintained)

---

## 🚀 Quick Fix

### Step 1: Restart Your Backend

```bash
cd api
# Stop server (Ctrl+C)
npm run dev
```

### Step 2: Try Login Again

The email will be **automatically verified** during login in development mode.

---

## 🔧 How It Works

**Development Mode** (`NODE_ENV !== 'production'`):
1. User tries to login with unverified email
2. Backend detects development mode
3. Automatically sets `isEmailVerified = true`
4. Saves to database
5. Login proceeds successfully

**Production Mode** (`NODE_ENV === 'production'`):
- Security maintained
- Still requires email verification
- Users must click verification link

---

## 🧪 Test It

1. **Restart backend**: `npm run dev` (in `api` folder)
2. **Try login** with your existing account
3. **Should work immediately** - email will be auto-verified

---

## 📝 Alternative: Manual Verification

If you want to verify the email manually in the database:

### Option 1: MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Go to `users` collection
4. Find your user by email
5. Update:
   ```json
   {
     "isEmailVerified": true
   }
   ```

### Option 2: Use Script

Create a script to verify user:

```bash
cd api
npx ts-node -e "
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { User } from './src/models/User';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/revocart');
  const user = await User.findOne({ email: 'your-email@example.com' });
  if (user) {
    user.isEmailVerified = true;
    await user.save();
    console.log('✅ Email verified for:', user.email);
  }
  process.exit(0);
})();
"
```

Replace `your-email@example.com` with your actual email.

---

## ✅ Verification

After fixing, you should be able to:
- ✅ Login with unverified email (in development)
- ✅ Email is auto-verified during login
- ✅ No more "Please verify your email" errors (in development)

---

## 🔒 Production Behavior

In production (`NODE_ENV=production`):
- ✅ Security is maintained
- ✅ Email verification is required
- ✅ Users must click verification link from email

---

**The fix is already applied!** Just restart your backend and try logging in again. 🎉

