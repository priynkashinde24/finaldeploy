# 🔴 Fix 404 and 500 Errors

## Errors
- `api/theme/active:1 Failed to load resource: the server responded with a status of 404`
- `api/branding/active:1 Failed to load resource: the server responded with a status of 404`
- `register:1 Failed to load resource: the server responded with a status of 500`

## ✅ Fixes Applied

### 1. Added DB Connection Middleware (`api/src/app.ts`)
   - ✅ Ensures MongoDB is connected before handling any requests
   - ✅ Waits for connection if it's in progress
   - ✅ Returns proper 503 error if connection fails
   - ✅ Skips DB check for health endpoints

### 2. Routes Are Correctly Defined
   - ✅ `/api/theme/active` - exists in `themeVariant.routes.ts`
   - ✅ `/api/branding/active` - exists in `branding.routes.ts`
   - ✅ `/api/auth/register` - exists in `authRoutes.ts`

## 🔧 Root Cause

The errors occur because:
1. **MongoDB connection not established** - Routes try to query DB before connection is ready
2. **Missing MONGODB_URI** - Environment variable not set in Vercel

## ⚠️ REQUIRED: Set MONGODB_URI in Vercel

### Step 1: Add Environment Variable
1. Go to: **Vercel Dashboard → Your Backend Project**
2. **Settings → Environment Variables**
3. Add:
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
   - **Environments**: Production, Preview, Development (select all)
4. **Save**

### Step 2: Verify MongoDB Atlas Network Access
1. Go to: **https://cloud.mongodb.com/**
2. **Network Access → Add IP Address**
3. Add `0.0.0.0/0` (allows Vercel servers)
4. **Confirm**

### Step 3: Redeploy Backend
After adding environment variable:
- **Push to GitHub** (auto-deploys)
- OR **Manual redeploy** in Vercel Dashboard

## 🧪 Test After Redeploy

### Test 1: Check DB Connection
```
GET https://alonecloneweb-application.vercel.app/ready
```
Should return: `{"status":"ok","db":"connected"}`

### Test 2: Test Theme Endpoint
```
GET https://alonecloneweb-application.vercel.app/api/theme/active
```
Should return theme data (not 404)

### Test 3: Test Branding Endpoint
```
GET https://alonecloneweb-application.vercel.app/api/branding/active
```
Should return branding data (not 404)

### Test 4: Test Register
Try registering a new user - should work (not 500)

## 📝 What Changed

**Before:**
- Routes tried to query MongoDB without checking connection
- No middleware to ensure DB is connected
- 404/500 errors when DB wasn't ready

**After:**
- Middleware ensures DB connection before routes
- Proper error messages if connection fails
- Routes wait for connection if in progress

## ✅ Expected Behavior

After setting `MONGODB_URI` and redeploying:
- ✅ All routes work correctly
- ✅ No 404 errors on theme/branding endpoints
- ✅ No 500 errors on register
- ✅ Proper error messages if DB connection fails


