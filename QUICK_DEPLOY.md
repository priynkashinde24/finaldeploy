# Quick Vercel Deployment Guide

## 🚀 Fast Deployment Steps

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy from Project Root
```bash
# From C:\AloneClone directory
vercel
```

Follow the prompts:
- ✅ Set up and deploy? **Yes**
- ✅ Which scope? **Your account**
- ✅ Link to existing project? **No** (first time)
- ✅ Project name? **revocart** (or your choice)
- ✅ Directory? **./** (root)
- ✅ Override settings? **No**

### 4. Set Environment Variables

After first deployment, go to [Vercel Dashboard](https://vercel.com/dashboard):

1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

#### Required Variables:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/revocart
JWT_SECRET=your-32-character-secret-key-here
JWT_REFRESH_SECRET=your-32-character-refresh-secret-here
FRONTEND_URL=https://your-app.vercel.app
```

#### Optional (with defaults):
```
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
```

**Important**: Replace `https://your-app.vercel.app` with your actual Vercel URL after first deployment!

### 5. Redeploy with Environment Variables
```bash
vercel --prod
```

Or click **Redeploy** in Vercel dashboard.

## ✅ Test Your Deployment

1. **Health Check**: `https://your-app.vercel.app/api/health`
2. **Register**: Visit `https://your-app.vercel.app/signup`
3. **Login**: Visit `https://your-app.vercel.app/login`

## 🔧 Troubleshooting

### API Returns 404
- Check `vercel.json` exists in root
- Verify `api/api/index.ts` exists
- Check build logs in Vercel dashboard

### Database Connection Fails
- Verify `MONGODB_URI` is set correctly
- Check MongoDB Atlas allows connections from anywhere (`0.0.0.0/0`)
- Verify database user has read/write permissions

### CORS Errors
- Update `FRONTEND_URL` in environment variables
- Ensure it matches your Vercel deployment URL exactly

## 📝 MongoDB Atlas Setup (If Needed)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (allow all)
5. Get connection string: `mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/revocart`

## 🎯 Next Steps

After successful deployment:
- Share the URL with your client
- Test all authentication flows
- Monitor Vercel function logs
- Set up error tracking (optional)

