# Frontend Vercel Deployment Guide

## Problem Fixed
- ✅ Removed frontend folder from `.vercelignore` 
- ✅ Updated `frontend/vercel.json` with backend API URL
- ✅ Frontend is now ready to deploy

## How to Deploy Frontend on Vercel

Since your backend is already deployed at `https://alonecloneweb-application.vercel.app/`, you need to create a **separate Vercel project** for the frontend.

### Steps:

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New..." → "Project"

2. **Import Your Repository**
   - Select the same repository: `priynkashinde24/alonecloneweb-application`
   - Click "Import"

3. **Configure Frontend Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: Set to `frontend` (IMPORTANT!)
   - **Build Command**: `npm run build` (auto-filled)
   - **Output Directory**: `.next` (auto-filled)
   - **Install Command**: `npm install` (auto-filled)

4. **Environment Variables**
   Add this environment variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://alonecloneweb-application.vercel.app/api`

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

## Current Configuration

- **Backend URL**: `https://alonecloneweb-application.vercel.app/`
- **Backend API**: `https://alonecloneweb-application.vercel.app/api`
- **Frontend Config**: Already set in `frontend/vercel.json`

## Notes

- The root `vercel.json` is for backend deployment
- The `frontend/vercel.json` is for frontend deployment
- Both projects can use the same GitHub repository
- Frontend will automatically use the backend URL from environment variables

## After Deployment

Once deployed, your frontend will be available at a URL like:
- `https://your-frontend-project.vercel.app`

Make sure to update CORS settings in your backend to allow requests from the frontend domain.



