# Quick Guide: Deploy Backend to Vercel

## ✅ YES! Your Backend CAN Be Deployed on Vercel

Your backend is already configured for Vercel serverless functions. Here's how to deploy it.

---

## 🚀 Quick Deployment Steps

### Step 1: Go to Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository

### Step 2: Configure Project Settings

**Important Settings**:

- **Root Directory**: `api` ⚠️ (NOT the root folder!)
- **Framework Preset**: Other
- **Build Command**: `npm run build` (or leave empty, Vercel auto-detects)
- **Output Directory**: (leave empty - not needed for serverless)
- **Install Command**: `npm install`

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app

# Node Environment
NODE_ENV=production

# Email (if using)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# SMS (if using)
FAST2SMS_API_KEY=your-api-key
```

### Step 4: Deploy!

Click **"Deploy"** and wait for the build to complete.

### Step 5: Get Your Backend URL

After deployment, Vercel will give you a URL like:
```
https://your-api-name.vercel.app
```

**All your API routes will be available at this URL**:
- `https://your-api-name.vercel.app/api/auth/login`
- `https://your-api-name.vercel.app/api/auth/register`
- `https://your-api-name.vercel.app/health`

---

## ✅ Test Your Deployment

### 1. Health Check

```bash
curl https://your-api-name.vercel.app/health
```

**Expected**: `{ "status": "ok", "message": "API is running" }`

### 2. Test Login

```bash
curl -X POST https://your-api-name.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## 🔧 Update Frontend

After backend is deployed, update your frontend Vercel project:

**Environment Variable**:
```env
NEXT_PUBLIC_API_URL=https://your-api-name.vercel.app/api
```

⚠️ **Important**: Must include `/api` at the end!

Then **redeploy** your frontend.

---

## ⚠️ Vercel Serverless Limitations

### What Works Great:
✅ REST APIs  
✅ Authentication endpoints  
✅ Database operations  
✅ File uploads  
✅ Webhooks  

### Limitations:
❌ **Cold Starts**: First request after inactivity may be slow (1-3 seconds)  
❌ **Execution Time**: 
   - Hobby plan: 10 seconds max
   - Pro plan: 60 seconds max
❌ **Background Jobs**: Not ideal for long-running tasks  
❌ **WebSockets**: Not supported  

### If You Need:
- Long-running background jobs → Use **Render** or **Railway**
- WebSocket support → Use **Render** or **Railway**
- No cold starts → Use **Render** or **Railway**

---

## 🆚 Vercel vs Render Comparison

| Feature | Vercel | Render |
|---------|--------|--------|
| **Free Tier** | ✅ Yes | ✅ Yes |
| **Cold Starts** | ❌ Yes (1-3s) | ✅ No |
| **Execution Time** | 10s (Hobby) / 60s (Pro) | ✅ Unlimited |
| **Background Jobs** | ❌ Not ideal | ✅ Supported |
| **WebSockets** | ❌ No | ✅ Yes |
| **Setup Difficulty** | ✅ Easy | ✅ Easy |
| **Best For** | REST APIs, Auth | Full backend, Jobs |

**Recommendation**: 
- **Just REST API** → Vercel works great!
- **Need background jobs/WebSockets** → Use Render

---

## 📋 Deployment Checklist

- [ ] Vercel account created
- [ ] GitHub repo connected
- [ ] Root directory set to `api`
- [ ] Environment variables set
- [ ] MongoDB connection string configured
- [ ] JWT secrets set
- [ ] `FRONTEND_URL` set
- [ ] `NODE_ENV=production` set
- [ ] Deployed successfully
- [ ] Health check works (`/health`)
- [ ] Frontend `NEXT_PUBLIC_API_URL` updated
- [ ] Frontend redeployed

---

## 🔍 Troubleshooting

### Issue: Build Fails

**Check**:
1. Root directory is `api` (not root)
2. `package.json` exists in `api/` folder
3. Build command is correct: `npm run build`

### Issue: "Module not found"

**Fix**: Ensure `vercel.json` points to correct path:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.ts"
    }
  ]
}
```

### Issue: Cold Start Timeouts

**Fix**: 
- Use Vercel Pro plan (60s timeout)
- Or optimize your code
- Or use Render instead (no cold starts)

### Issue: MongoDB Connection Errors

**Fix**: 
- Check `MONGODB_URI` is set correctly
- Ensure MongoDB Atlas allows connections from Vercel IPs (0.0.0.0/0)

---

## 🎯 Quick Start Commands

### Deploy via Vercel CLI (Optional)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (from project root)
cd api
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? revocart-api
# - Directory? ./
# - Override settings? No
```

---

## ✅ Summary

**YES, your backend CAN be deployed on Vercel!**

**Steps**:
1. ✅ Go to Vercel Dashboard
2. ✅ Import GitHub repo
3. ✅ Set Root Directory to `api`
4. ✅ Add environment variables
5. ✅ Deploy!
6. ✅ Update frontend `NEXT_PUBLIC_API_URL`
7. ✅ Test login

**Your backend is already configured!** Just follow the steps above. 🚀

For detailed instructions, see: `api/VERCEL_BACKEND_DEPLOYMENT.md`

