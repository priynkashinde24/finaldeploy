# Vercel Deployment Guide

This guide will help you deploy your frontend and backend to Vercel with proper environment variable configuration.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket Account**: Your code should be in a Git repository
3. **Node.js**: Ensure your project builds successfully locally

---

## 🚀 Step 1: Prepare Your Repository

### 1.1 Push to New Repository

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for Vercel deployment"

# Add your new repository (replace with your repo URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Push to repository
git push -u origin main
```

---

## 🌐 Step 2: Deploy Frontend to Vercel

### 2.1 Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. Select the repository containing your frontend code

### 2.2 Configure Frontend Project

**Project Settings:**
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `frontend` (if your frontend is in a subdirectory)
- **Build Command**: `npm run build` (or `cd frontend && npm run build` if in subdirectory)
- **Output Directory**: `.next` (default for Next.js)
- **Install Command**: `npm install` (or `cd frontend && npm install`)

### 2.3 Add Frontend Environment Variables

Click on **"Environment Variables"** and add the following:

#### Required Environment Variables:

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `NEXT_PUBLIC_API_URL` | Your backend API URL | `https://your-api.vercel.app/api` or `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_SITE_URL` | Your frontend site URL | `https://your-frontend.vercel.app` or `https://yourdomain.com` |

#### Optional Environment Variables:

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| `NEXT_PUBLIC_STATIC_EXPORT` | Enable static export | `true` or leave empty |

**How to Add:**
1. In your Vercel project dashboard, go to **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Enter the variable name (e.g., `NEXT_PUBLIC_API_URL`)
4. Enter the value (e.g., `https://your-api.vercel.app/api`)
5. Select environments: **Production**, **Preview**, **Development** (or as needed)
6. Click **"Save"**

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete
3. Your frontend will be live at `https://your-project.vercel.app`

---

## 🔧 Step 3: Deploy Backend API to Vercel

### 3.1 Create API Project

1. In Vercel Dashboard, click **"Add New..."** → **"Project"**
2. Import the same repository (or create a separate one for API)
3. Configure the API project:

**Project Settings:**
- **Framework Preset**: Other (or Node.js)
- **Root Directory**: `api` (if your API is in a subdirectory)
- **Build Command**: `cd api && npm run build` (or `npm run build`)
- **Output Directory**: `api/dist` (or wherever your build outputs)
- **Install Command**: `cd api && npm install` (or `npm install`)

### 3.2 Configure API Routes

Create a `vercel.json` file in your API root directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/src/app.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/src/app.ts"
    }
  ]
}
```

Or if your API is in a subdirectory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/src/app.ts"
    }
  ]
}
```

### 3.3 Add Backend Environment Variables

Add all your backend environment variables in Vercel:

**Common Backend Environment Variables:**

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `5000` (Vercel auto-assigns) |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `JWT_REFRESH_SECRET` | JWT refresh secret | `your-refresh-secret` |
| `API_URL` | API base URL | `https://your-api.vercel.app` |
| `FRONTEND_URL` | Frontend URL | `https://your-frontend.vercel.app` |
| `EMAIL_USER` | Email service user | `your-email@gmail.com` |
| `EMAIL_PASS` | Email service password | `your-app-password` |
| `FAST2SMS_API_KEY` | SMS API key | `your-sms-api-key` |
| `DATA_ENCRYPTION_KEY` | Data encryption key | `your-encryption-key` |
| `PCI_ENCRYPTION_KEY` | PCI encryption key | `your-pci-key` |
| `ENCRYPTION_KEY_ID` | Encryption key ID | `default-key-v1` |

**Add these in Vercel:**
1. Go to your API project → **Settings** → **Environment Variables**
2. Add each variable with appropriate values
3. Select environments (Production, Preview, Development)

---

## 🔗 Step 4: Link Frontend and Backend

### 4.1 Update Frontend API URL

After deploying your backend, update the frontend environment variable:

1. Go to your **Frontend Project** in Vercel
2. **Settings** → **Environment Variables**
3. Update `NEXT_PUBLIC_API_URL` to your backend URL:
   ```
   https://your-api-project.vercel.app/api
   ```
4. Redeploy the frontend (or it will auto-redeploy on next push)

### 4.2 Update Backend Frontend URL

1. Go to your **Backend Project** in Vercel
2. **Settings** → **Environment Variables**
3. Add/Update `FRONTEND_URL`:
   ```
   https://your-frontend-project.vercel.app
   ```

---

## 📝 Step 5: Environment-Specific Configuration

### 5.1 Production Environment

Set all environment variables for **Production** environment in Vercel.

### 5.2 Preview Environment

You can use the same values or different ones for preview deployments (staging).

### 5.3 Development Environment

For local development, create a `.env.local` file:

**Frontend `.env.local`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Backend `.env` (in `api/` directory):**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/your-db
JWT_SECRET=your-dev-secret
JWT_REFRESH_SECRET=your-dev-refresh-secret
# ... other variables
```

---

## 🔒 Step 6: Security Best Practices

1. **Never commit `.env` files** - Add them to `.gitignore`
2. **Use strong secrets** - Generate random strings for JWT secrets
3. **Rotate keys regularly** - Especially encryption keys
4. **Use Vercel's environment variable encryption** - Vercel encrypts variables at rest
5. **Limit access** - Only add team members who need access

---

## 🧪 Step 7: Testing Deployment

### 7.1 Test Frontend

1. Visit your frontend URL: `https://your-frontend.vercel.app`
2. Check browser console for errors
3. Test API calls are working

### 7.2 Test Backend

1. Test API endpoint: `https://your-api.vercel.app/api/health` (if you have one)
2. Check Vercel function logs for errors
3. Test authentication endpoints

---

## 🐛 Troubleshooting

### Issue: Frontend can't connect to API

**Solution:**
- Check `NEXT_PUBLIC_API_URL` is set correctly
- Ensure backend is deployed and accessible
- Check CORS settings in backend

### Issue: Environment variables not working

**Solution:**
- Variables must start with `NEXT_PUBLIC_` to be accessible in frontend
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### Issue: Build fails

**Solution:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify build commands are correct

### Issue: API routes not working

**Solution:**
- Check `vercel.json` configuration
- Ensure API files are in correct directory
- Verify serverless function configuration

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

---

## ✅ Checklist

- [ ] Code pushed to Git repository
- [ ] Frontend project created in Vercel
- [ ] Frontend environment variables added
- [ ] Frontend deployed successfully
- [ ] Backend project created in Vercel
- [ ] Backend environment variables added
- [ ] `vercel.json` configured for API
- [ ] Backend deployed successfully
- [ ] Frontend and backend linked correctly
- [ ] Tested deployment end-to-end
- [ ] Custom domain configured (optional)

---

## 🎉 You're Done!

Your application should now be live on Vercel. Remember to:
- Monitor deployments in Vercel dashboard
- Check logs for any errors
- Update environment variables as needed
- Keep your dependencies updated


