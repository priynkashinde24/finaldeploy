# 🚨 URGENT: Add MONGODB_URI to Vercel

## Current Error
```
[MIDDLEWARE] DB connection error: MONGODB_URI environment variable is not set!
[MIDDLEWARE] Error details: { hasMongoUri: false, readyState: 0, errorCode: undefined }
```

## ✅ IMMEDIATE FIX REQUIRED

The `MONGODB_URI` environment variable is **NOT SET** in your Vercel project. You must add it now.

### Step 1: Get Your MongoDB Connection String

Your connection string should be:
```
mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
```

**Important Notes:**
- Password is URL-encoded: `@` becomes `%40`
- Database name is: `revocart`
- Make sure there are **no spaces** or line breaks

### Step 2: Add MONGODB_URI to Vercel

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Sign in to your account

2. **Select Your Backend Project**
   - Find your project: `alonecloneweb-application` (or your backend project name)
   - Click on it to open

3. **Navigate to Environment Variables**
   - Click **"Settings"** in the top menu
   - Click **"Environment Variables"** in the left sidebar

4. **Add New Environment Variable**
   - Click the **"Add New"** button (top right)
   - Fill in the form:
     - **Key**: `MONGODB_URI`
     - **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
     - **Environments**: 
       - ✅ **Production** (MUST check this)
       - ✅ **Preview** (recommended)
       - ✅ **Development** (recommended)
   - Click **"Save"**

### Step 3: Verify MongoDB Atlas Network Access

Before redeploying, make sure MongoDB Atlas allows Vercel's servers:

1. **Go to MongoDB Atlas**
   - Visit: https://cloud.mongodb.com/
   - Sign in to your account

2. **Navigate to Network Access**
   - Click **"Network Access"** in the left sidebar

3. **Check IP Whitelist**
   - Look for `0.0.0.0/0` in the list
   - If it's NOT there:
     - Click **"Add IP Address"**
     - Click **"Allow Access from Anywhere"**
     - Click **"Confirm"**

### Step 4: Redeploy Your Backend

**After adding the environment variable, you MUST redeploy:**

1. **Go to Vercel Dashboard** → Your Backend Project
2. **Click "Deployments"** tab
3. **Click "..."** (three dots) on the latest deployment
4. **Click "Redeploy"**
   - OR push a new commit to trigger auto-deploy

**⚠️ IMPORTANT:** Environment variables are only available to new deployments. You must redeploy after adding them!

### Step 5: Verify It's Working

After redeploy, check the logs:

1. **Go to Vercel Dashboard** → Your Backend Project
2. **Click "Deployments"** tab
3. **Click on the latest deployment**
4. **Click "Functions"** tab
5. **Look for logs** - you should see:
   ```
   ✅ MongoDB Connected
      Host: cluster0.mzws36m.mongodb.net
      Database: revocart
   ```

**NOT:**
```
[MIDDLEWARE] DB connection error: MONGODB_URI environment variable is not set!
```

## 🔍 Troubleshooting

### If you still see the error after adding MONGODB_URI:

1. **Verify Environment Variable is Set:**
   - Go to Vercel → Settings → Environment Variables
   - Make sure `MONGODB_URI` is listed
   - Make sure it's enabled for **Production** environment
   - Check the value is correct (no typos)

2. **Verify You Redeployed:**
   - Environment variables only apply to NEW deployments
   - You must redeploy after adding them
   - Check the deployment timestamp - it should be AFTER you added the variable

3. **Check for Typos:**
   - Key must be exactly: `MONGODB_URI` (case-sensitive)
   - Value must be the full connection string
   - No extra spaces or quotes

4. **Verify Connection String Format:**
   - Must start with `mongodb+srv://` or `mongodb://`
   - Must include username and password
   - Password must be URL-encoded (`@` → `%40`)
   - Must include database name after `/`

## 📝 Quick Checklist

- [ ] Added `MONGODB_URI` to Vercel Environment Variables
- [ ] Enabled for Production environment
- [ ] Value is correct (no typos)
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0`
- [ ] Redeployed the backend after adding the variable
- [ ] Checked logs to verify connection is working

## ✅ Success Indicators

After completing these steps, you should see:
- ✅ No "MONGODB_URI environment variable is not set" errors
- ✅ MongoDB connection logs showing successful connection
- ✅ Login, OTP, and other database operations working
- ✅ No timeout errors

## 🔗 Quick Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **MongoDB Atlas**: https://cloud.mongodb.com/
- **MongoDB Atlas Network Access**: https://cloud.mongodb.com/v2#/security/network/whitelist

