# Vercel Deployment Checklist

## Pre-Deployment

- [x] ✅ Created `vercel.json` configuration
- [x] ✅ Created serverless API handler (`api/api/index.ts`)
- [x] ✅ Updated Next.js config for deployment
- [x] ✅ Installed `@vercel/node` package
- [x] ✅ Created deployment documentation

## Before Deploying

### 1. MongoDB Setup
- [ ] Create MongoDB Atlas account (free tier)
- [ ] Create database cluster
- [ ] Create database user (save credentials!)
- [ ] Whitelist IP: `0.0.0.0/0` (allow all for testing)
- [ ] Get connection string: `mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/revocart`

### 2. Generate Secrets
- [ ] Generate JWT_SECRET (32+ characters, random)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Generate JWT_REFRESH_SECRET (32+ characters, different from JWT_SECRET)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 3. Git Commit
- [ ] Commit all changes to Git
- [ ] Push to GitHub (recommended for Vercel)

## Deployment Steps

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
# From project root (C:\AloneClone)
vercel
```

**First deployment prompts:**
- Set up and deploy? → **Yes**
- Which scope? → **Your account**
- Link to existing project? → **No**
- Project name? → **revocart** (or your choice)
- Directory? → **./** (root)
- Override settings? → **No**

### Step 4: Note Your URLs
After deployment, Vercel will show:
- Frontend URL: `https://revocart-xxxxx.vercel.app`
- API URL: Same domain, routes to `/api/*`

### Step 5: Set Environment Variables

Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables

Add these (replace with your actual values):

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB connection string |
| `JWT_SECRET` | `your-32-char-secret` | Generated secret key |
| `JWT_REFRESH_SECRET` | `your-32-char-secret` | Different from JWT_SECRET |
| `FRONTEND_URL` | `https://revocart-xxxxx.vercel.app` | Your Vercel deployment URL |
| `JWT_EXPIRES_IN` | `15m` | Optional (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Optional (default: 7d) |
| `NODE_ENV` | `production` | Optional |

**Important**: Update `FRONTEND_URL` with your actual Vercel URL!

### Step 6: Redeploy
```bash
vercel --prod
```

Or click **Redeploy** button in Vercel dashboard.

## Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```
Expected: `{"status":"ok","message":"API is running"}`

### 2. Test Registration
Visit: `https://your-app.vercel.app/signup`
- Fill form
- Submit
- Should redirect to dashboard or show success

### 3. Test Login
Visit: `https://your-app.vercel.app/login`
- Use registered credentials
- Should authenticate successfully

### 4. Check Logs
- Go to Vercel Dashboard → Your Project → Logs
- Check for errors
- Verify MongoDB connection successful

## Common Issues & Fixes

### ❌ API Returns 404
**Fix**: 
- Check `vercel.json` exists in root
- Verify `api/api/index.ts` exists
- Check build logs for errors

### ❌ Database Connection Failed
**Fix**:
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (`0.0.0.0/0`)
- Verify database user has permissions

### ❌ CORS Errors
**Fix**:
- Update `FRONTEND_URL` in environment variables
- Must match your Vercel URL exactly (no trailing slash)
- Redeploy after updating

### ❌ JWT Errors
**Fix**:
- Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- Ensure they're different values
- Must be 32+ characters

## Client Testing Checklist

Share these with your client:

- [ ] Registration works
- [ ] Login works
- [ ] Logout works
- [ ] Can create stores
- [ ] Can view dashboard
- [ ] All pages load correctly
- [ ] No console errors

## Production Considerations

Before going live:
- [ ] Use strong, unique JWT secrets
- [ ] Restrict MongoDB IP whitelist (specific IPs)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Enable Vercel Analytics
- [ ] Set up monitoring/alerts
- [ ] Review security best practices

## Support

If deployment fails:
1. Check Vercel build logs
2. Check MongoDB connection
3. Verify all environment variables
4. Test API endpoints with curl/Postman
5. Review `DEPLOYMENT.md` for detailed troubleshooting

