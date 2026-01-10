# Vercel Deployment Guide

This guide explains how to deploy both the frontend and backend to Vercel.

## 🚀 Quick Start: Setting Environment Variables

**Step-by-step:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Click **"Settings"** tab → **"Environment Variables"** (left sidebar)
4. Click **"Add New"**
5. Enter **Key** and **Value**
6. Select environments (Production, Preview, Development)
7. Click **"Save"**
8. **Redeploy** your project for changes to take effect

**Visual Path:** Dashboard → Your Project → Settings → Environment Variables → Add New

## Prerequisites

1. Vercel account (sign up at https://vercel.com)
2. GitHub repository with your code
3. MongoDB database (MongoDB Atlas recommended)
4. Environment variables ready

## Deployment Strategy

Deploy **two separate Vercel projects**:
- **Frontend**: Next.js app (automatic detection)
- **Backend**: Express API as serverless functions

---

## Step 1: Deploy Backend API

### 1.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. **Root Directory**: Select `api` folder

### 1.2 Configure Build Settings

- **Framework Preset**: Other
- **Root Directory**: `api`
- **Build Command**: `npm run build`
- **Output Directory**: Leave empty (not needed for serverless)
- **Install Command**: `npm install`

### 1.3 Environment Variables

**How to Set Environment Variables in Vercel:**

1. **Go to your Vercel project:**
   - Open [Vercel Dashboard](https://vercel.com/dashboard)
   - Click on your **backend project** (the one you just created)

2. **Navigate to Settings:**
   - Click on the **"Settings"** tab at the top
   - In the left sidebar, click **"Environment Variables"**

3. **Add each variable:**
   - Click **"Add New"** button
   - Enter the **Key** (variable name) in the first field
   - Enter the **Value** in the second field
   - Select environments: **Production**, **Preview**, and **Development** (or just Production)
   - Click **"Save"**
   - Repeat for each variable below

**Required Environment Variables for Backend:**

| Key | Value | Example |
|-----|-------|---------|
| `NODE_ENV` | `production` | `production` |
| `MONGODB_URI` | Your MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `JWT_ACCESS_SECRET` | Your JWT access token secret | `your-super-secret-key-here` |
| `JWT_REFRESH_SECRET` | Your JWT refresh token secret | `your-refresh-secret-key-here` |
| `FRONTEND_URL` | Your frontend URL (update after frontend deploys) | `https://your-frontend.vercel.app` |
| `PORT` | `5000` | `5000` |

**Optional Environment Variables (if using):**

| Key | Value | Example |
|-----|-------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key | `sk_live_...` |
| `RAZORPAY_KEY_ID` | Your Razorpay key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay key secret | `your_razorpay_secret` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_USER` | Email address | `your-email@gmail.com` |
| `EMAIL_PASS` | Email password/app password | `your-app-password` |

**Important Notes:**
- ⚠️ **Never commit `.env` files to GitHub** - Vercel handles this securely
- 🔒 Values are encrypted and only visible when editing
- 🔄 After adding/updating variables, **redeploy** your project for changes to take effect
- 📝 You can add variables one at a time or use the bulk import feature

### 1.4 Deploy

Click **"Deploy"**. Vercel will:
- Build your TypeScript code
- Create serverless functions from your Express routes
- Deploy to a URL like: `https://your-api-name.vercel.app`

**Note the API URL** - you'll need it for the frontend!

---

## Step 2: Deploy Frontend

### 2.1 Connect Repository

1. In Vercel Dashboard, click **"Add New Project"** again
2. Import the same GitHub repository
3. **Root Directory**: Select `frontend` folder

### 2.2 Configure Build Settings

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### 2.3 Environment Variables

**How to Set Environment Variables for Frontend:**

1. **Go to your frontend project:**
   - In Vercel Dashboard, click on your **frontend project**

2. **Navigate to Settings:**
   - Click **"Settings"** tab → **"Environment Variables"** in left sidebar

3. **Add each variable:**

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api-name.vercel.app` | Replace with your **actual backend URL** from Step 1 |
| `NEXT_PUBLIC_SITE_URL` | `https://your-frontend-name.vercel.app` | Your frontend URL (will be assigned after first deploy) |
| `NODE_ENV` | `production` | Set to production |

**Important Notes:**
- 🔑 Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- ⚠️ **Never put secrets in `NEXT_PUBLIC_*` variables** - they're visible in client-side code
- 🔄 After adding variables, redeploy for changes to take effect
- 📝 You'll need to update `NEXT_PUBLIC_API_URL` after your backend deploys (get the URL from Step 1)

### 2.4 Deploy

Click **"Deploy"**. Vercel will:
- Build your Next.js app
- Deploy to a URL like: `https://your-frontend-name.vercel.app`

---

## Step 3: Update CORS Settings

After both deployments, update your backend CORS to allow the frontend domain:

1. Go to backend Vercel project → Settings → Environment Variables
2. Update `FRONTEND_URL` to your actual frontend URL:
   ```
   FRONTEND_URL=https://your-frontend-name.vercel.app
   ```
3. Redeploy the backend

---

## Step 4: Verify Deployment

### Backend Health Check
Visit: `https://your-api-name.vercel.app/health`
Should return: `{"status":"ok","message":"API is running"}`

### Frontend
Visit: `https://your-frontend-name.vercel.app`
Should show your homepage

### Test API Connection
Open browser console on frontend, check for:
- No CORS errors
- API calls returning 200 (not 404/500)

---

## Troubleshooting

### Backend Issues

**Error: "Cannot find module"**
- Ensure `api/api/index.ts` exists
- Check that `vercel.json` points to correct path

**Error: "MongoDB connection failed"**
- Verify `MONGODB_URI` is set correctly
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Vercel)

**Error: "Environment variables missing"**
- Double-check all required env vars are set in Vercel
- Redeploy after adding variables

**Error: "ERR_CONNECTION_REFUSED" or "Failed to load resource"**
- This usually happens when `dotenv.config()` tries to load a `.env` file that doesn't exist on Vercel
- **FIX**: The code has been updated to only load `.env` files in development mode
- On Vercel, environment variables are automatically available via `process.env` (no `.env` file needed)
- Make sure all environment variables are set in Vercel Dashboard → Settings → Environment Variables
- After setting env vars, redeploy your backend

### Frontend Issues

**Error: "API calls failing"**
- Verify `NEXT_PUBLIC_API_URL` is set to backend URL
- Check CORS settings on backend
- Ensure backend is deployed and accessible

**Error: "Build failed"**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Try clearing `.next` cache locally and redeploy

---

## Custom Domains

### Backend Domain
1. Go to backend project → Settings → Domains
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Update DNS records as instructed
4. Update `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` with new domain

### Frontend Domain
1. Go to frontend project → Settings → Domains
2. Add your custom domain (e.g., `yourdomain.com`)
3. Update DNS records as instructed

---

## Continuous Deployment

Both projects will automatically redeploy when you push to your main branch:
- Backend: Deploys from `api/` folder
- Frontend: Deploys from `frontend/` folder

To deploy manually:
- Go to project → Deployments → Redeploy

---

## Production Checklist

- [ ] Backend deployed and health check passes
- [ ] Frontend deployed and loads correctly
- [ ] Environment variables set for both projects
- [ ] CORS configured correctly
- [ ] MongoDB connection working
- [ ] API endpoints responding correctly
- [ ] Frontend can communicate with backend
- [ ] Custom domains configured (if applicable)
- [ ] SSL certificates active (automatic with Vercel)

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for frontend errors
3. Test API endpoints directly with Postman/curl
4. Verify all environment variables are set

