# Vercel Full Stack Deployment Guide

This guide will help you deploy both **Frontend (Next.js)** and **Backend (Express API)** together on Vercel.

## 📋 Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository** - Your code should be in a GitHub repository
3. **MongoDB Atlas** - Your database connection string ready

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

Make sure your project structure is:
```
AloneClone/
├── api/              # Backend (Express + TypeScript)
│   ├── src/
│   ├── api/
│   │   └── index.ts  # Vercel serverless entry point
│   └── package.json
├── frontend/         # Frontend (Next.js)
│   ├── src/
│   └── package.json
├── vercel.json       # Vercel configuration (root)
└── index.js          # Optional root entry point
```

### Step 2: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

#### Required Environment Variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart

# Node Environment
NODE_ENV=production

# Frontend API URL (for production)
NEXT_PUBLIC_API_URL=https://your-project.vercel.app/api
```

#### Optional Environment Variables (if needed):

```env
# PayPal (if using PayPal payments)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENV=sandbox

# Stripe (if using Stripe payments)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# JWT Secret
JWT_SECRET=your_jwt_secret

# Email Service (if using email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Step 3: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root of repository)
   - **Build Command**: Leave empty (Vercel will auto-detect)
   - **Output Directory**: Leave empty
5. Add all environment variables (from Step 2)
6. Click **"Deploy"**

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# For production deployment
vercel --prod
```

### Step 4: Verify Deployment

After deployment, check:

1. **Frontend**: `https://your-project.vercel.app`
2. **Backend API**: `https://your-project.vercel.app/api/health` (or any API endpoint)

## 📁 Project Structure for Vercel

The `vercel.json` file routes requests as follows:

- **API Routes** (`/api/*`) → Backend serverless function (`api/api/index.ts`)
- **All Other Routes** (`/*`) → Frontend Next.js app (`frontend/`)

## 🔧 Configuration Files

### Root `vercel.json`

This file handles routing between frontend and backend:

```json
{
  "version": 2,
  "buildCommand": "cd api && npm install && npm run build",
  "installCommand": "npm install && cd frontend && npm install && cd ../api && npm install",
  "framework": null,
  "builds": [
    {
      "src": "api/api/index.ts",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/api/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ]
}
```

## 🐛 Troubleshooting

### Issue: Backend API not working

**Solution:**
1. Check that `MONGODB_URI` is set correctly in Vercel environment variables
2. Verify MongoDB Atlas IP whitelist includes Vercel IPs (or use `0.0.0.0/0` for testing)
3. Check Vercel function logs: **Deployments** → **Functions** → **View Logs**

### Issue: Frontend can't connect to backend

**Solution:**
1. Set `NEXT_PUBLIC_API_URL` environment variable to your Vercel URL
2. Make sure API routes are prefixed with `/api/`
3. Check browser console for CORS errors

### Issue: Build fails

**Solution:**
1. Check that all dependencies are in `package.json` files
2. Verify TypeScript compilation: `cd api && npm run build`
3. Check build logs in Vercel dashboard

### Issue: MongoDB connection timeout

**Solution:**
1. Verify MongoDB Atlas cluster is running (not paused)
2. Check Network Access in MongoDB Atlas (whitelist `0.0.0.0/0` for Vercel)
3. Verify connection string format (URL-encoded password)

## 📝 Important Notes

1. **MongoDB Connection**: The connection string in `api/index.js` and `api/src/config/db.ts` will use the `MONGODB_URI` environment variable set in Vercel.

2. **Serverless Functions**: Backend runs as serverless functions. Each API route is a separate function invocation.

3. **Cold Starts**: First request after inactivity may be slower (cold start). Subsequent requests are faster.

4. **Environment Variables**: Always set sensitive values in Vercel dashboard, never commit them to Git.

5. **Build Process**: 
   - Backend TypeScript is compiled during build
   - Frontend Next.js is built automatically
   - Both are deployed together

## ✅ Post-Deployment Checklist

- [ ] Frontend loads correctly
- [ ] Backend API responds to requests
- [ ] MongoDB connection works
- [ ] Authentication works (if implemented)
- [ ] API routes are accessible
- [ ] Environment variables are set
- [ ] Custom domain configured (optional)

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [MongoDB Atlas Network Access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)

## 🎉 Success!

Once deployed, your full-stack application will be live at:
- **Frontend**: `https://your-project.vercel.app`
- **Backend API**: `https://your-project.vercel.app/api`

Both frontend and backend are now deployed together on Vercel! 🚀

