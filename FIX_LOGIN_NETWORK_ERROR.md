# Fix Login Network Error - Complete Guide

## ✅ Changes Made

### 1. **CORS Configuration Fixed** (`api/src/app.ts`)
   - ✅ Now allows all `*.vercel.app` domains automatically
   - ✅ No need to manually add frontend URL to backend CORS
   - ✅ Still supports environment variables for custom domains

### 2. **Frontend API URL Updated** (`frontend/src/lib/api.ts`)
   - ✅ Default API URL now points to: `https://alonecloneweb-application.vercel.app/api`
   - ✅ Falls back to localhost only in development

## 🔧 Required Vercel Environment Variables

### Backend Project (alonecloneweb-application)
Go to: **Vercel Dashboard → Your Backend Project → Settings → Environment Variables**

**Required Variables:**
```
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
NODE_ENV=production
```

**Optional (for specific frontend domain):**
```
FRONTEND_URL=https://your-frontend-project.vercel.app
```

### Frontend Project
Go to: **Vercel Dashboard → Your Frontend Project → Settings → Environment Variables**

**Required Variable:**
```
NEXT_PUBLIC_API_URL=https://alonecloneweb-application.vercel.app/api
```

## 📋 Step-by-Step Fix

### Step 1: Set Frontend Environment Variable
1. Go to your **Frontend Vercel Project**
2. Navigate to **Settings → Environment Variables**
3. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://alonecloneweb-application.vercel.app/api`
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**
5. **Redeploy** your frontend project

### Step 2: Verify Backend CORS
The backend now automatically allows all Vercel frontend domains. No changes needed!

### Step 3: Test Login
1. Go to your frontend URL
2. Try to login
3. Check browser console (F12) for any errors
4. Check Network tab to see if API calls are going to the correct URL

## 🐛 Troubleshooting

### Still Getting Network Error?

1. **Check API URL in Browser Console:**
   ```javascript
   // Open browser console and run:
   console.log(process.env.NEXT_PUBLIC_API_URL);
   // Should show: https://alonecloneweb-application.vercel.app/api
   ```

2. **Check Network Tab:**
   - Open DevTools → Network tab
   - Try to login
   - Look for the login request
   - Check if it's going to: `https://alonecloneweb-application.vercel.app/api/auth/login`
   - Check the response status (should be 200, not CORS error)

3. **Check CORS Headers:**
   - In Network tab, click on the failed request
   - Check Response Headers
   - Should see: `Access-Control-Allow-Origin: https://your-frontend.vercel.app`

4. **Verify Backend is Running:**
   - Visit: `https://alonecloneweb-application.vercel.app/`
   - Should see: `{"success":true,"message":"Revocart API is running",...}`

5. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

## ✅ Expected Behavior After Fix

- ✅ Login requests go to: `https://alonecloneweb-application.vercel.app/api/auth/login`
- ✅ CORS allows requests from your frontend domain
- ✅ No "Network Error" or "CORS Error" messages
- ✅ Login works successfully

## 📝 Notes

- The frontend will use the environment variable `NEXT_PUBLIC_API_URL` if set
- If not set, it defaults to the production backend URL
- CORS now automatically allows all `*.vercel.app` domains
- You can still set specific frontend URLs via environment variables if needed

