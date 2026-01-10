# Fix: Vercel Build Stuck / Not Deploying

## 🔍 Problem
Build shows "Running vercel build" but doesn't complete or deploy.

---

## ✅ Quick Fixes

### 1. Check Full Build Logs

**Scroll down in the Vercel build logs** to see if there are errors:
- Look for red error messages
- Check for TypeScript compilation errors
- Look for missing dependencies

### 2. Verify Environment Variables Are Set

**Critical**: Make sure these are added in Vercel Dashboard:

1. Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**
2. Add these (if not already added):

```
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
JWT_ACCESS_SECRET=da60ca6306866f9cb6f7fc855e0e91dadc64d884f75a995125559e155592f67b5f918771310472c73a9d4c500aaff55e8d27cbbab7c3e3949d203528d3cfd5ff
JWT_REFRESH_SECRET=86c862c0e0b3f82f2bbfc074ba425c78c52c2b2909c927716734b6e230e139b5535432802d3e422d2d68d308a366734788cb91b6fb4eae70048e55728478c81c
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

3. **Select all environments**: ☑ Production ☑ Preview ☑ Development
4. **Save** and **Redeploy**

### 3. Check Root Directory Setting

**In Vercel Dashboard:**

1. Go to **Settings → General**
2. Check **Root Directory**:
   - If deploying backend only: Set to `api`
   - If deploying from root: Leave empty or set to `.`

### 4. Update vercel.json Build Command

The build might be failing silently. Try updating `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "cd api && npm install && npm run build",
  "installCommand": "cd api && npm install",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/api/index.ts"
    },
    {
      "source": "/health",
      "destination": "/api/api/index.ts"
    },
    {
      "source": "/ready",
      "destination": "/api/api/index.ts"
    },
    {
      "source": "/",
      "destination": "/api/api/index.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "api/api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

**Change**: Added `npm install` to `buildCommand` to ensure dependencies are installed before building.

---

## 🔧 Alternative: Deploy from `api/` Folder

If root deployment keeps failing, deploy from `api/` folder:

### Step 1: Set Root Directory

1. Vercel Dashboard → Settings → General
2. Set **Root Directory** to: `api`
3. Save

### Step 2: Use `api/vercel.json`

The `api/vercel.json` is already configured correctly.

### Step 3: Redeploy

This should work better as Vercel will only build the backend.

---

## 🐛 Common Errors to Look For

### Error: "Missing required env vars"

**Solution**: Add all environment variables in Vercel Dashboard (see step 2 above)

### Error: TypeScript compilation errors

**Solution**: 
1. Check build logs for specific errors
2. Fix TypeScript errors locally first
3. Test build locally: `cd api && npm run build`

### Error: "Module not found"

**Solution**:
1. Check `api/package.json` has all dependencies
2. Make sure `npm install` runs successfully
3. Check for missing `@types/*` packages

### Error: Build timeout

**Solution**:
1. The build might be taking too long
2. Check if `npm install` is hanging
3. Try reducing dependencies or using `npm ci` instead

---

## 📋 Step-by-Step Debugging

1. **Check Build Logs** (scroll down in Vercel)
   - Look for error messages
   - Check where it stops

2. **Verify Environment Variables**
   - Go to Settings → Environment Variables
   - Make sure all required vars are added
   - Check they're set for Production environment

3. **Test Build Locally**
   ```bash
   cd api
   npm install
   npm run build
   ```
   - If this fails locally, fix errors first
   - Then redeploy

4. **Check Vercel Project Settings**
   - Root Directory: Should be `api` or `.`
   - Framework: Should be "Other" (not Next.js)
   - Build Command: Should match `vercel.json`

5. **Redeploy**
   - After making changes, click "Redeploy" in Vercel

---

## ✅ Quick Checklist

- [ ] Environment variables added in Vercel
- [ ] Root Directory set correctly
- [ ] Build logs checked for errors
- [ ] Local build works (`cd api && npm run build`)
- [ ] `vercel.json` is correct
- [ ] Redeployed after changes

---

## 🆘 Still Not Working?

1. **Share the full build logs** (scroll to the bottom, copy error messages)
2. **Check if local build works**: `cd api && npm run build`
3. **Try deploying from `api/` folder** (set Root Directory to `api`)

---

The most common issue is **missing environment variables**. Make sure all required vars are added in Vercel Dashboard! 🎯

