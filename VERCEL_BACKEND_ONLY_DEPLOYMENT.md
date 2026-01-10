# Vercel Backend-Only Deployment Guide

If you're deploying **only the backend** (without frontend), follow this guide.

## 🚀 Quick Deployment

### Step 1: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:

```env
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
NODE_ENV=production
```

### Step 2: Deploy Backend Only

#### Option A: Deploy from `api/` folder

1. In Vercel dashboard, set **Root Directory** to `api`
2. Use the `api/vercel.json` configuration
3. Deploy

#### Option B: Deploy from root with backend-only config

Update root `vercel.json` to:

```json
{
  "version": 2,
  "buildCommand": "cd api && npm install && npm run build",
  "installCommand": "cd api && npm install",
  "framework": null,
  "builds": [
    {
      "src": "api/api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/api/index.ts"
    }
  ],
  "functions": {
    "api/api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

## ✅ Fixed Issues

1. **Root Route (`/`)**: Now returns API information instead of "Route / not found"
2. **Health Check**: Available at `/health`
3. **Readiness Check**: Available at `/ready`

## 🧪 Test Your Deployment

After deployment, test these endpoints:

- **Root**: `https://your-project.vercel.app/`
  - Should return: `{ success: true, message: "Revocart API is running", ... }`

- **Health**: `https://your-project.vercel.app/health`
  - Should return: `{ status: "ok", message: "API is running" }`

- **Ready**: `https://your-project.vercel.app/ready`
  - Should return: `{ status: "ok", db: "connected" }`

- **API Routes**: `https://your-project.vercel.app/api/*`
  - All your API endpoints should work

## 🔧 Troubleshooting

### Error: "Route / not found"

**Solution**: Make sure:
1. The root route handler is in `api/src/app.ts` (already added)
2. `vercel.json` routes `/` to the backend
3. Rebuild and redeploy

### Error: MongoDB connection failed

**Solution**:
1. Check `MONGODB_URI` is set in Vercel environment variables
2. Verify MongoDB Atlas IP whitelist includes Vercel IPs
3. Check connection string format (URL-encoded password)

### Error: Build fails

**Solution**:
1. Check TypeScript compilation: `cd api && npm run build`
2. Verify all dependencies are in `api/package.json`
3. Check build logs in Vercel dashboard

## 📝 Notes

- Backend runs as serverless functions on Vercel
- Each API route is a separate function invocation
- First request after inactivity may be slower (cold start)
- MongoDB connection is cached between invocations

