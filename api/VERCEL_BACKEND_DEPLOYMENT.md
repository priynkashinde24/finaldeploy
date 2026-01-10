# Deploy Backend to Vercel

## ✅ Yes, Your Backend CAN Be Deployed on Vercel!

Your backend is already configured for Vercel serverless functions. Here's how to deploy it.

## 📋 Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository** - Your code should be on GitHub
3. **MongoDB Atlas** - For production database (or your MongoDB connection string)

## 🚀 Deployment Steps

### Step 1: Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### Step 2: Deploy from Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. **Important**: Set the **Root Directory** to `api` (not the root!)
5. Configure:

   **Framework Preset**: Other
   
   **Root Directory**: `api`
   
   **Build Command**: `npm run build` (or leave empty, Vercel will auto-detect)
   
   **Output Directory**: Leave empty (not needed for serverless)
   
   **Install Command**: `npm install`

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app
VERCEL_FRONTEND_URL=https://your-custom-domain.com  # Optional

# Node Environment
NODE_ENV=production

# Email (if using)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Payment Gateways (if using)
STRIPE_SECRET_KEY=sk_live_...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# SMS (if using)
FAST2SMS_API_KEY=your_api_key

# Other env vars your app needs
```

### Step 4: Deploy!

Click **"Deploy"** and wait for the build to complete.

### Step 5: Get Your Backend URL

After deployment, Vercel will give you a URL like:
```
https://your-api-name.vercel.app
```

**Important**: All routes will be available at this URL. For example:
- `https://your-api-name.vercel.app/api/auth/login`
- `https://your-api-name.vercel.app/health`

---

## ⚠️ Important Considerations

### Vercel Serverless Limitations

1. **Cold Starts**: First request after inactivity may be slow (1-3 seconds)
2. **Execution Time**: 
   - Hobby plan: 10 seconds max
   - Pro plan: 60 seconds max
3. **Memory**: Limited (1GB on Hobby, 3GB on Pro)
4. **Background Jobs**: Not ideal for long-running tasks
5. **WebSockets**: Not supported (if you need them)

### What Works Well on Vercel

✅ REST APIs  
✅ Authentication endpoints  
✅ Database operations  
✅ File uploads (with proper handling)  
✅ Webhooks  

### What Might Be Problematic

❌ Long-running background jobs (use external service)  
❌ WebSocket connections  
❌ Very large file processing  
❌ Scheduled cron jobs (use Vercel Cron or external service)  

---

## 🔧 Alternative: Deploy to Render/Railway (Recommended for Full Backend)

If you have background jobs, scheduled tasks, or need more control, consider:

### **Render** (Recommended - Free tier available)
- ✅ Full Node.js server (no cold starts)
- ✅ Background jobs support
- ✅ Scheduled tasks
- ✅ WebSocket support
- ✅ Free tier available

**Deploy to Render:**
1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Set:
   - **Root Directory**: `api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables
6. Deploy!

### **Railway**
- Similar to Render
- Easy deployment
- Good free tier

---

## 📝 Vercel Configuration Files

Your project already has:

### `api/vercel.json`
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
      "dest": "api/index.ts"
    }
  ]
}
```

### `api/api/index.ts`
This is your Vercel serverless function entry point. It:
- Connects to MongoDB
- Loads your Express app
- Handles all routes

---

## 🧪 Testing After Deployment

1. **Health Check**:
   ```bash
   curl https://your-api-name.vercel.app/health
   ```
   Should return: `{ "status": "ok", "message": "API is running" }`

2. **Test Login**:
   ```bash
   curl -X POST https://your-api-name.vercel.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

3. **Update Frontend**:
   In your Vercel frontend project, set:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-name.vercel.app/api
   ```

---

## 🔍 Troubleshooting

### Issue: "Module not found" errors
**Fix**: Ensure `vercel.json` points to correct path and TypeScript is compiled.

### Issue: Cold start timeouts
**Fix**: 
- Use Vercel Pro plan (60s timeout)
- Or optimize your code
- Or use Render/Railway instead

### Issue: MongoDB connection errors
**Fix**: 
- Check `MONGODB_URI` is set correctly
- Ensure MongoDB Atlas allows connections from Vercel IPs (0.0.0.0/0)

### Issue: CORS errors
**Fix**: 
- Set `FRONTEND_URL` environment variable
- Check `api/src/app.ts` CORS configuration

### Issue: Cookies not working
**Fix**: 
- Ensure `NODE_ENV=production` is set
- Cookies are already configured for cross-origin (sameSite: 'none')

---

## 📊 Monitoring

Vercel provides:
- **Logs**: Dashboard → Your Project → Logs
- **Analytics**: Function execution times, errors
- **Real-time**: View logs as requests come in

---

## 🎯 Recommendation

**For this project, I recommend:**

1. **If you have background jobs** → Use **Render** or **Railway**
2. **If it's just REST API** → **Vercel works great!**
3. **If you need both** → Deploy API to Render, frontend to Vercel

---

## ✅ Quick Deploy Checklist

- [ ] Vercel account created
- [ ] GitHub repo connected
- [ ] Root directory set to `api`
- [ ] Environment variables set
- [ ] MongoDB connection string configured
- [ ] JWT secrets set
- [ ] `FRONTEND_URL` set
- [ ] Deployed successfully
- [ ] Health check works
- [ ] Frontend `NEXT_PUBLIC_API_URL` updated

---

**Ready to deploy?** Follow the steps above and you'll have your backend live in minutes! 🚀

