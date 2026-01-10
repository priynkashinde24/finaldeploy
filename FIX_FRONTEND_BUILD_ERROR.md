# Fix: "Module not found: Can't resolve '@/lib/utils'"

## 🚨 Problem

Vercel is trying to build the **frontend** (Next.js) even though we only want to build the **backend**. The error occurs because:

1. Vercel auto-detects Next.js in the `frontend/` folder
2. It tries to build the frontend
3. Frontend uses `@/lib/utils` path alias which isn't resolved during build

## ✅ Solution

### Option 1: Exclude Frontend from Build (Recommended)

**Updated `.vercelignore`:**
```
frontend/
frontend/**
```

**Updated `vercel.json`:**
```json
{
  "framework": null,
  ...
}
```

This tells Vercel:
- Don't auto-detect Next.js
- Only build what's specified in `buildCommand`
- Ignore the `frontend/` folder

### Option 2: Set Root Directory to `api`

**In Vercel Dashboard:**
1. Go to **Settings → General**
2. Set **Root Directory** to: `api`
3. This makes Vercel only see the `api/` folder
4. Frontend won't be detected

## 📋 Changes Made

1. ✅ Added `"framework": null` to `vercel.json`
2. ✅ Added `frontend/` to `.vercelignore`
3. ✅ This prevents Vercel from auto-detecting Next.js

## 🎯 Next Steps

1. **Commit the changes:**
   ```bash
   git add vercel.json .vercelignore
   git commit -m "Prevent frontend build, only build backend"
   git push
   ```

2. **Redeploy on Vercel**

3. **Verify:** Build should only build the backend now

---

The error should be fixed! Vercel will now only build the backend API, not the frontend. 🚀







