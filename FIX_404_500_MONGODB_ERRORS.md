# Fix 404/500 Errors and MongoDB Connection Timeout

## Current Errors

1. **404 Errors:**
   - `api/branding/active:1 Failed to load resource: the server responded with a status of 404`
   - `api/theme/active:1 Failed to load resource: the server responded with a status of 404`

2. **500 Error:**
   - `login:1 Failed to load resource: the server responded with a status of 500`

3. **MongoDB Timeout:**
   - `Operation users.findOne() buffering timed out after 10000ms`

## Root Cause

**MongoDB is not connected!** The `MONGODB_URI` environment variable is not set in your Vercel backend project, causing all database operations to timeout.

## ✅ Fixes Applied

### 1. Improved DB Connection Middleware (`api/src/app.ts`)
- ✅ Better path matching to catch all API routes
- ✅ Improved error logging with request path
- ✅ Prevents sending response if headers already sent

### 2. Routes Already Handle Errors Gracefully
- ✅ `/api/theme/active` - Returns `null` if store not found or DB error
- ✅ `/api/branding/active` - Returns `null` if store not found or DB error
- ✅ Both routes use `safeDbQuery` with timeout handling

## 🔴 REQUIRED: Set MONGODB_URI in Vercel

### Step 1: Add Environment Variable

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **Backend Project**: `alonecloneweb-application`
3. Navigate to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Enter:
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
   - **Environments**: 
     - ✅ **Production** (MUST check)
     - ✅ **Preview** (recommended)
     - ✅ **Development** (recommended)
6. Click **"Save"**

### Step 2: Verify MongoDB Atlas Network Access

1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com/)
2. Navigate to **Network Access**
3. Ensure `0.0.0.0/0` is in the IP whitelist (allows Vercel servers)
4. If not, click **"Add IP Address"** → Enter `0.0.0.0/0` → **Confirm**

### Step 3: REDEPLOY Backend (CRITICAL!)

**⚠️ Environment variables only take effect after redeploy!**

**Option A: Manual Redeploy**
1. Vercel Dashboard → Your Backend Project
2. **Deployments** tab
3. Click **"..."** on latest deployment
4. Click **"Redeploy"**
5. **Wait for completion** (2-5 minutes)

**Option B: Push to GitHub** (if connected)
```bash
git add .
git commit -m "Fix MongoDB connection and improve error handling"
git push origin main
```

## 🧪 Test After Redeploy

### Test 1: Check Backend Health
```bash
GET https://alonecloneweb-application.vercel.app/ready
```
Should return: `{"status":"ok","db":"connected"}`

### Test 2: Test Theme Endpoint
```bash
GET https://alonecloneweb-application.vercel.app/api/theme/active
```
Should return: `{"data":{"theme":null}}` (or theme data if store is set)

### Test 3: Test Branding Endpoint
```bash
GET https://alonecloneweb-application.vercel.app/api/branding/active
```
Should return: `{"data":{"branding":null}}` (or branding data if store is set)

### Test 4: Test Login
Try logging in from your frontend. Should work without timeout errors.

## 📋 Expected Behavior After Fix

1. **404 Errors → 200 OK** (with null data if no store)
   - Routes will return `{"data":{"theme":null}}` or `{"data":{"branding":null}}` instead of 404

2. **500 Error → 200 OK** (login works)
   - Login endpoint will successfully query MongoDB

3. **MongoDB Timeout → No Timeout**
   - All database operations will complete successfully

## 🔍 Troubleshooting

### Still Getting 404 Errors?
- Check that routes are registered in `api/src/app.ts` (lines 301-302)
- Verify backend is redeployed with latest code
- Check browser Network tab for actual response (might be 503, not 404)

### Still Getting MongoDB Timeout?
1. **Verify Environment Variable:**
   - Vercel Dashboard → Backend Project → Settings → Environment Variables
   - Check `MONGODB_URI` exists and value is correct
   - Make sure it's enabled for **Production** environment

2. **Check MongoDB Atlas:**
   - Cluster is running (not paused)
   - Network Access allows `0.0.0.0/0`
   - Database user exists and password is correct
   - Password is URL-encoded (`@` → `%40`)

3. **Check Backend Logs:**
   - Vercel Dashboard → Backend Project → Deployments → Latest → Functions
   - Look for `[MIDDLEWARE]` logs showing connection status

### Getting 503 Instead of 404?
This is **correct behavior**! The middleware is catching the DB connection failure and returning 503 (Service Unavailable) instead of letting routes fail with 404/500. After setting `MONGODB_URI` and redeploying, you'll get 200 responses.

## 📝 Summary

- ✅ Code fixes applied (improved middleware, error handling)
- ⚠️ **ACTION REQUIRED**: Set `MONGODB_URI` in Vercel
- ⚠️ **ACTION REQUIRED**: Redeploy backend after setting environment variable
- ✅ Routes will work correctly once MongoDB is connected


