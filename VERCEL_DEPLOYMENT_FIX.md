# Vercel + Separate Backend Deployment Fix

This guide fixes the classic Vercel + separate backend deployment issues (CORS, cookies, environment variables).

## ✅ What Was Fixed

1. **Backend CORS** - Now supports multiple origins (localhost + Vercel domain)
2. **Cookie Configuration** - Fixed for cross-origin requests (`sameSite: 'none'`, `secure: true` in production)
3. **CSRF Cookies** - Updated for cross-origin compatibility
4. **All Auth Functions** - Login, refresh, logout, magic login, OTP all use correct cookie settings

## 🚀 Deployment Checklist

### 1️⃣ Backend Deployment (MUST BE DEPLOYED FIRST)

Deploy your backend to one of these services:
- **Render** (recommended - easiest)
- **Railway**
- **Heroku**
- **AWS EC2 / VPS**

#### Backend Environment Variables

Set these in your backend hosting platform:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app

# Optional: If you have a custom Vercel domain
VERCEL_FRONTEND_URL=https://your-custom-domain.com

# Node Environment
NODE_ENV=production

# Port (usually auto-set by hosting platform)
PORT=5000
```

#### Backend Start Command

```bash
npm install
npm run build
npm start
```

#### Verify Backend is Running

1. Open: `https://your-backend-domain.com/health`
2. Should return: `{ "status": "ok", "message": "API is running" }`

If this fails → **Backend is NOT reachable** → Fix backend deployment first!

---

### 2️⃣ Frontend Deployment (Vercel)

#### Vercel Environment Variables

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Your backend URL **WITH `/api` suffix** | `https://your-backend.onrender.com/api` |

⚠️ **CRITICAL**: The URL must include `/api` at the end!

**Examples:**
- ✅ Correct: `https://api.example.com/api`
- ✅ Correct: `https://your-backend.onrender.com/api`
- ❌ Wrong: `https://api.example.com` (missing `/api`)
- ❌ Wrong: `http://localhost:5000` (won't work on Vercel)

#### After Setting Environment Variables

**MANDATORY**: Redeploy your Vercel project after setting environment variables!

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Or push a new commit to trigger redeploy

---

### 3️⃣ CORS Configuration

The backend now automatically allows:
- `http://localhost:3000` (development)
- Your `FRONTEND_URL` environment variable
- Your `VERCEL_FRONTEND_URL` environment variable (if set)

**No code changes needed** - just set the environment variables!

---

### 4️⃣ Cookie Configuration

Cookies are now configured correctly:
- **Development**: `sameSite: 'lax'` (works for localhost)
- **Production**: `sameSite: 'none'` + `secure: true` (works for cross-origin)

**No code changes needed** - automatically detects `NODE_ENV=production`!

---

## 🧪 Testing Your Deployment

### Step 1: Test Backend Health

```bash
curl https://your-backend-domain.com/health
```

Expected response:
```json
{ "status": "ok", "message": "API is running" }
```

### Step 2: Test Login from Frontend

1. Open your Vercel frontend: `https://your-frontend.vercel.app/login`
2. Try to login
3. Open browser DevTools → Network tab
4. Check the login request:

**✅ Success indicators:**
- Request goes to: `https://your-backend-domain.com/api/auth/login`
- Status: `200 OK`
- Response has: `{ "success": true, "data": { "accessToken": "...", "user": {...} } }`

**❌ Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `net::ERR_CONNECTION_REFUSED` | Backend URL wrong or backend not deployed | Check `NEXT_PUBLIC_API_URL` and backend deployment |
| `CORS error` | Backend CORS not configured | Set `FRONTEND_URL` in backend env vars |
| `401 Unauthorized` | Auth logic issue | Check backend logs |
| `403 Forbidden` | CSRF or cookie issue | Check cookie settings (should be `sameSite: 'none'` in prod) |
| Cookies not working | Cookie config wrong | Already fixed in code - ensure `NODE_ENV=production` |

---

## 🔍 Debugging Checklist

### Backend Logs

Check your backend hosting platform logs for:
- ❌ MongoDB connection errors
- ❌ CORS errors
- ❌ Missing environment variables
- ❌ Token verification errors

### Frontend Console

Open browser DevTools → Console, look for:
- `[AUTH] Login request: ...`
- `[AUTH] Login response: ...`
- Any CORS or network errors

### Network Tab

Check the login request:
1. **Request URL**: Should be your backend URL
2. **Request Headers**: Should include `Content-Type: application/json`
3. **Response Headers**: Should include `Set-Cookie` for `refreshToken` and `csrf_token`
4. **Response Body**: Should have `accessToken` and `user` data

---

## 📝 Quick Reference

### Backend Environment Variables

```env
MONGODB_URI=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
PORT=5000
```

### Frontend Environment Variables (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
```

### Important URLs

- **Backend Health**: `https://your-backend-domain.com/health`
- **Backend Login**: `https://your-backend-domain.com/api/auth/login`
- **Frontend**: `https://your-frontend.vercel.app`

---

## ✅ Final Confirmation

Before considering it "done", verify:

- [ ] Backend deployed and `/health` endpoint works
- [ ] `NEXT_PUBLIC_API_URL` set in Vercel (with `/api` suffix)
- [ ] `FRONTEND_URL` set in backend env vars
- [ ] Vercel project redeployed after setting env vars
- [ ] Login works from Vercel frontend
- [ ] Cookies are set (check DevTools → Application → Cookies)
- [ ] No CORS errors in browser console
- [ ] No network errors in browser console

---

## 🆘 Still Not Working?

If login still fails after following this guide:

1. **Share these details:**
   - Backend deployment URL
   - Frontend Vercel URL
   - Browser console errors (screenshot)
   - Network tab for login request (screenshot)
   - Backend logs (last 50 lines)

2. **Common last-resort fixes:**
   - Clear browser cookies and cache
   - Try incognito/private browsing
   - Check if backend is actually running (curl `/health`)
   - Verify environment variables are set correctly
   - Ensure backend is using HTTPS (required for `sameSite: 'none'`)

---

## 📚 Code Changes Made

### Backend (`api/src/app.ts`)
- ✅ CORS now supports multiple origins
- ✅ Automatically allows localhost in development

### Backend (`api/src/controllers/auth.controller.ts`)
- ✅ All cookie settings use `sameSite: 'none'` in production
- ✅ All cookie settings use `secure: true` in production
- ✅ Fixed in: `login()`, `refresh()`, `logout()`, `magicLogin()`, `verifyOTP()`

### Backend (`api/src/utils/csrf.ts`)
- ✅ CSRF cookies use `sameSite: 'none'` in production
- ✅ CSRF cookies use `secure: true` in production

### Frontend
- ✅ No changes needed - already configured correctly!

---

**Last Updated**: After implementing all fixes
**Status**: ✅ Production-ready

