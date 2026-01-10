# Quick Fix: Login "Account pending admin approval" Error

## 🚀 Immediate Solution

The backend now **auto-approves users during login in development mode**. 

### Step 1: Restart Your Backend

```bash
# Stop your backend (Ctrl+C)
# Then restart it:
cd api
npm run dev
```

### Step 2: Try Login Again

The user will be **automatically approved** when you login in development mode.

---

## 🔧 Alternative: Manual Approval (If Still Not Working)

### Option 1: Use the Script

```bash
cd api
npx ts-node scripts/approve-user.ts your-email@example.com
```

### Option 2: Direct MongoDB Command

If you have MongoDB Compass or `mongosh`:

```javascript
// Connect to your database
use revocart

// Approve your user
db.users.updateOne(
  { email: "your-email@example.com" },
  { 
    $set: { 
      approvalStatus: "approved",
      isActive: true,
      approvedAt: new Date()
    }
  }
)
```

### Option 3: Check NODE_ENV

Make sure `NODE_ENV` is NOT set to `production` in your `.env` file:

```env
# In api/.env - make sure this is NOT set, or set to:
NODE_ENV=development
# OR just remove the line entirely
```

---

## ✅ What Changed

The login function now:
1. **Checks if in development mode** (`NODE_ENV !== 'production'`)
2. **Auto-approves pending users** during login
3. **Activates the account** automatically
4. **Allows login** to proceed

**No more manual approval needed in development!**

---

## 🧪 Test It

1. **Restart backend**: `npm run dev` (in `api` folder)
2. **Try login** with your existing account
3. **Should work immediately** - user will be auto-approved

---

## 📝 If Still Not Working

Check these:

1. ✅ Backend restarted?
2. ✅ `NODE_ENV` not set to `production`?
3. ✅ MongoDB connection working?
4. ✅ User exists in database?

Run this to check user status:
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
  console.log('User status:', {
    email: user?.email,
    approvalStatus: user?.approvalStatus,
    isActive: user?.isActive,
    role: user?.role
  });
  process.exit(0);
})();
"
```

Replace `your-email@example.com` with your actual email.

---

**The fix is applied! Just restart your backend and try again.** 🎉

