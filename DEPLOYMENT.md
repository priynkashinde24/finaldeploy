# Vercel Deployment Guide

This guide will help you deploy your Revocart application to Vercel for client testing.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Database**: 
   - Free tier: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a cluster and get your connection string
3. **GitHub Repository**: Push your code to GitHub (recommended)

## Deployment Options

### Option 1: Deploy Everything on Vercel (Recommended for Testing)

This deploys both frontend and backend on Vercel using serverless functions.

#### Step 1: Prepare Environment Variables

Create a `.env` file in the root directory with these variables:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/revocart

# JWT Secrets (generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (will be set after deployment)
FRONTEND_URL=https://your-app.vercel.app
```

#### Step 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? revocart (or your choice)
# - Directory? ./
# - Override settings? No
```

#### Step 3: Set Environment Variables in Vercel Dashboard

1. Go to your project on [vercel.com](https://vercel.com)
2. Navigate to **Settings** → **Environment Variables**
3. Add all variables from `.env.example`
4. **Important**: Update `FRONTEND_URL` with your actual Vercel deployment URL
5. Update `NEXT_PUBLIC_API_URL` to point to your Vercel API (same domain)

#### Step 4: Redeploy

After setting environment variables, trigger a new deployment:

```bash
vercel --prod
```

Or redeploy from the Vercel dashboard.

---

### Option 2: Separate Deployments (Frontend on Vercel, Backend on Railway/Render)

This is better for production but requires two deployments.

#### Frontend on Vercel

1. Deploy only the frontend:
   ```bash
   cd frontend
   vercel
   ```

2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = Your backend URL (e.g., `https://your-api.railway.app/api`)

#### Backend on Railway (Recommended)

1. Sign up at [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Select your repository
4. Set root directory to `api`
5. Add environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `FRONTEND_URL` = Your Vercel frontend URL
6. Railway will auto-deploy

#### Backend on Render (Alternative)

1. Sign up at [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repository
4. Settings:
   - **Root Directory**: `api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables (same as Railway)
6. Deploy

---

## Post-Deployment Checklist

- [ ] Test API health endpoint: `https://your-app.vercel.app/api/health`
- [ ] Test user registration: `https://your-app.vercel.app/signup`
- [ ] Test user login: `https://your-app.vercel.app/login`
- [ ] Verify MongoDB connection (check Vercel logs)
- [ ] Test cookie-based authentication (refresh token)
- [ ] Update CORS settings if needed

## Troubleshooting

### API Routes Return 404

- Check `vercel.json` routing configuration
- Ensure `api/api/index.ts` exists
- Verify build completed successfully

### Database Connection Errors

- Verify `MONGODB_URI` is set correctly
- Check MongoDB Atlas IP whitelist (allow all: `0.0.0.0/0`)
- Ensure database user has proper permissions

### CORS Errors

- Update `FRONTEND_URL` in environment variables
- Check `api/src/app.ts` CORS configuration
- Ensure `withCredentials: true` in frontend API config

### Environment Variables Not Working

- Variables must be set in Vercel dashboard
- Frontend variables must start with `NEXT_PUBLIC_`
- Redeploy after adding variables

## Testing the Deployment

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```

### 2. Register User
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "reseller"
  }'
```

### 3. Login
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

## Production Considerations

1. **Security**:
   - Use strong, unique JWT secrets (32+ characters)
   - Enable HTTPS only (Vercel does this automatically)
   - Set secure cookie flags in production

2. **Performance**:
   - Enable MongoDB connection pooling
   - Consider CDN for static assets
   - Monitor Vercel function execution time

3. **Monitoring**:
   - Set up Vercel Analytics
   - Monitor MongoDB Atlas metrics
   - Set up error tracking (Sentry, etc.)

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check MongoDB Atlas connection logs
3. Verify all environment variables are set
4. Test API endpoints with curl/Postman

