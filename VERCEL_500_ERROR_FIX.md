# Fixing Vercel 500 Internal Server Error

## 🔍 Common Causes

The 500 error usually happens due to:

1. **Missing Environment Variables** ⚠️ (Most Common)
2. **MongoDB Connection Issues**
3. **Invalid MongoDB URI Format**
4. **MongoDB Atlas Network Access Not Configured**

---

## ✅ Step-by-Step Fix

### Step 1: Check Vercel Logs

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your **backend project**
3. Go to **"Deployments"** tab
4. Click on the **latest deployment**
5. Click **"Functions"** tab
6. Click on the function that's failing
7. Check the **"Logs"** tab for error messages

**Look for errors like:**
- `Missing required env vars: ...`
- `MONGODB_URI environment variable is not set!`
- `Failed to connect to database`
- `Authentication failed`

---

### Step 2: Verify Environment Variables

Go to **Settings → Environment Variables** and ensure you have:

#### Required Variables:
- ✅ `NODE_ENV` = `production`
- ✅ `MONGODB_URI` = Your MongoDB connection string
- ✅ `JWT_ACCESS_SECRET` = Your JWT secret
- ✅ `JWT_REFRESH_SECRET` = Your JWT refresh secret
- ✅ `FRONTEND_URL` = Your frontend URL

**Check:**
- [ ] All variables are set (no empty values)
- [ ] No typos in variable names
- [ ] Values don't have extra spaces
- [ ] MongoDB URI includes database name

---

### Step 3: Verify MongoDB Connection String

Your `MONGODB_URI` should look like:

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/database_name?retryWrites=true&w=majority
```

**Common Issues:**
- ❌ Missing database name: `...mongodb.net/?retryWrites...` 
  - ✅ Fix: `...mongodb.net/revocart?retryWrites...`
- ❌ Placeholder values: `username:password`
  - ✅ Fix: Replace with actual username and password
- ❌ Special characters in password not encoded
  - ✅ Fix: `@` → `%40`, `#` → `%23`, `$` → `%24`

---

### Step 4: Check MongoDB Atlas Settings

1. **Network Access:**
   - Go to MongoDB Atlas → **Network Access**
   - Click **"Add IP Address"**
   - Add `0.0.0.0/0` (allow all IPs for Vercel)
   - Click **"Confirm"**

2. **Database User:**
   - Go to **Database Access**
   - Verify your user exists
   - Check password is correct
   - User should have **"Read and write to any database"** permission

3. **Cluster Status:**
   - Go to **Clusters**
   - Ensure cluster is **running** (not paused)
   - If paused, click **"Resume"**

---

### Step 5: Test MongoDB Connection

Test your connection string locally:

```bash
# In your terminal
node -e "
const mongoose = require('mongoose');
mongoose.connect('YOUR_MONGODB_URI_HERE')
  .then(() => console.log('✅ Connected!'))
  .catch(err => console.error('❌ Error:', err.message));
"
```

Replace `YOUR_MONGODB_URI_HERE` with your actual connection string.

---

### Step 6: Redeploy After Fixes

After fixing environment variables:

1. Go to Vercel Dashboard → Your Project
2. Go to **"Deployments"** tab
3. Click the **three dots** (⋯) on latest deployment
4. Click **"Redeploy"**
5. Wait for deployment to complete

---

## 🔧 Quick Checklist

Before redeploying, verify:

- [ ] All environment variables are set in Vercel
- [ ] `MONGODB_URI` is valid and includes database name
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0`
- [ ] MongoDB Atlas cluster is running (not paused)
- [ ] Database user exists and password is correct
- [ ] Special characters in password are URL-encoded
- [ ] No typos in environment variable names

---

## 📋 Environment Variables Checklist

### Backend (Required):
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/revocart?retryWrites=true&w=majority
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
FRONTEND_URL=https://your-frontend.vercel.app
PORT=5000
```

---

## 🐛 Debugging Tips

### Check Function Logs:
1. Vercel Dashboard → Your Project → Deployments
2. Click latest deployment → Functions tab
3. Click the function → Logs tab
4. Look for error messages

### Test Health Endpoint:
Visit: `https://your-backend.vercel.app/health`

Should return: `{"status":"ok","message":"API is running"}`

If it returns 500, check the logs for the specific error.

---

## 💡 Still Not Working?

1. **Check Vercel Build Logs:**
   - Deployments → Latest → Build Logs
   - Look for TypeScript compilation errors

2. **Verify vercel.json:**
   - Should point to `api/index.ts`
   - Root directory should be `api`

3. **Check Package.json:**
   - Ensure `@vercel/node` is in devDependencies
   - Build script should be `npm run build`

4. **Contact Support:**
   - Share the error logs from Vercel
   - Include your environment variable names (not values!)

---

## ✅ After Fixing

Once fixed, you should see:
- ✅ Health endpoint returns 200 OK
- ✅ No errors in Vercel function logs
- ✅ Database connection successful in logs
- ✅ API endpoints responding correctly

