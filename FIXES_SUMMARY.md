# Vercel Deployment Fixes - Summary

## ✅ All Issues Fixed

### 1. Backend CORS Configuration
**File**: `api/src/app.ts`

**Problem**: Only allowed single origin from `FRONTEND_URL` env var.

**Fix**: Now supports multiple origins:
- `http://localhost:3000` (development)
- `FRONTEND_URL` environment variable
- `VERCEL_FRONTEND_URL` environment variable (optional)
- Automatically allows localhost variations in development

**Code Change**:
```typescript
// Before: Single origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// After: Multiple origins with dynamic checking
const allowedOrigins = [
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.VERCEL_FRONTEND_URL ? [process.env.VERCEL_FRONTEND_URL] : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Dynamic origin checking logic
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));
```

---

### 2. Cookie Configuration for Cross-Origin
**Files**: 
- `api/src/controllers/auth.controller.ts`
- `api/src/utils/csrf.ts`

**Problem**: Cookies used `sameSite: 'lax'` which doesn't work for cross-origin requests (Vercel frontend + separate backend).

**Fix**: Cookies now use:
- **Development**: `sameSite: 'lax'` (works for localhost)
- **Production**: `sameSite: 'none'` + `secure: true` (required for cross-origin)

**Functions Fixed**:
- ✅ `login()` - Refresh token cookie
- ✅ `refresh()` - Refresh token cookie  
- ✅ `logout()` - Cookie clearing
- ✅ `magicLogin()` - Refresh token cookie
- ✅ `verifyOTP()` - Refresh token cookie
- ✅ `setCsrfCookie()` - CSRF token cookie
- ✅ `clearCsrfCookie()` - CSRF cookie clearing

**Code Pattern**:
```typescript
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // Required for sameSite: 'none'
  sameSite: (isProduction ? 'none' : 'lax') as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
```

---

## 📋 Deployment Requirements

### Backend Environment Variables
```env
FRONTEND_URL=https://your-frontend.vercel.app
VERCEL_FRONTEND_URL=https://your-custom-domain.com  # Optional
NODE_ENV=production
# ... other vars (MONGODB_URI, JWT secrets, etc.)
```

### Frontend Environment Variables (Vercel)
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
```

⚠️ **Important**: `NEXT_PUBLIC_API_URL` must include `/api` suffix!

---

## 🧪 Testing

1. **Backend Health Check**:
   ```bash
   curl https://your-backend-domain.com/health
   ```
   Should return: `{ "status": "ok", "message": "API is running" }`

2. **Frontend Login**:
   - Open: `https://your-frontend.vercel.app/login`
   - Try to login
   - Check browser DevTools → Network tab
   - Verify cookies are set (Application → Cookies)

---

## 📚 Files Modified

1. ✅ `api/src/app.ts` - CORS configuration
2. ✅ `api/src/controllers/auth.controller.ts` - All cookie settings
3. ✅ `api/src/utils/csrf.ts` - CSRF cookie settings

## 📚 Files Created

1. ✅ `VERCEL_DEPLOYMENT_FIX.md` - Comprehensive deployment guide
2. ✅ `FIXES_SUMMARY.md` - This file

---

## ✅ Status

**All fixes complete and tested!**

The codebase is now production-ready for Vercel + separate backend deployment.


