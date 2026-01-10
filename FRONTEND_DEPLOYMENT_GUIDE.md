# Frontend Deployment Guide for Vercel

This is a step-by-step guide to deploy your Next.js frontend to Vercel.

---

## 📋 Prerequisites

1. ✅ Your code is in a Git repository (GitHub, GitLab, or Bitbucket)
2. ✅ You have a Vercel account ([vercel.com](https://vercel.com))
3. ✅ Your frontend builds successfully locally (`npm run build`)

---

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to Git Repository

If you haven't already:

```bash
# Navigate to your project root
cd C:\Users\offic\OneDrive\Desktop\priyanka\AloneClone

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Vercel deployment"

# Add your repository (replace with your actual repo URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Push to repository
git push -u origin main
```

---

### Step 2: Import Project to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in or create an account

2. **Import Project**
   - Click **"Add New..."** button (top right)
   - Select **"Project"**
   - Click **"Import Git Repository"**
   - Select your repository (GitHub/GitLab/Bitbucket)
   - Click **"Import"**

---

### Step 3: Configure Frontend Project

Vercel will auto-detect Next.js, but verify these settings:

#### Project Settings:

1. **Project Name**: 
   - Enter a name (e.g., `aloneclone-frontend`)
   - This will be your URL: `https://your-project-name.vercel.app`

2. **Framework Preset**: 
   - Should auto-detect: **Next.js**
   - If not, select **Next.js**

3. **Root Directory**: 
   - If your frontend is in a subdirectory, click **"Edit"**
   - Enter: `frontend`
   - If frontend is in root, leave empty

4. **Build and Output Settings**:
   - **Build Command**: `npm run build` (or `cd frontend && npm run build` if in subdirectory)
   - **Output Directory**: `.next` (default for Next.js)
   - **Install Command**: `npm install` (or `cd frontend && npm install`)

5. **Environment Variables** (Click "Environment Variables" section):
   - We'll add these in the next step

---

### Step 4: Add Environment Variables

**Before deploying, add these environment variables:**

1. **Click "Environment Variables"** section (or go to Settings → Environment Variables after deployment)

2. **Add First Variable:**
   - Click **"Add New"**
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-api-project.vercel.app/api`
     - ⚠️ **Important**: Replace `your-api-project` with your actual API project name
     - If API is not deployed yet, use: `http://localhost:5000/api` (you can update later)
   - **Environments**: 
     - ☑ Production
     - ☑ Preview  
     - ☑ Development
   - Click **"Save"**

3. **Add Second Variable:**
   - Click **"Add New"** again
   - **Name**: `NEXT_PUBLIC_SITE_URL`
   - **Value**: `https://your-frontend-project.vercel.app`
     - ⚠️ Replace `your-frontend-project` with your actual project name
     - Or use: `http://localhost:3000` for now
   - **Environments**: 
     - ☑ Production
     - ☑ Preview
     - ☑ Development
   - Click **"Save"**

#### Environment Variables Summary:

| Variable Name | Value | Purpose |
|--------------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.vercel.app/api` | Backend API endpoint |
| `NEXT_PUBLIC_SITE_URL` | `https://your-frontend.vercel.app` | Frontend site URL |

**⚠️ Important Notes:**
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- After adding variables, you must redeploy for them to take effect
- Variable names are **case-sensitive**

---

### Step 5: Deploy

1. **Review Settings**: Make sure everything looks correct

2. **Click "Deploy"** button (bottom right)

3. **Wait for Build**:
   - Vercel will:
     - Install dependencies (`npm install`)
     - Build your project (`npm run build`)
     - Deploy to production
   - This usually takes 2-5 minutes

4. **Monitor Build Logs**:
   - Watch the build process in real-time
   - Check for any errors or warnings
   - If build fails, check the error messages

---

### Step 6: Verify Deployment

1. **Get Your URL**:
   - After successful deployment, you'll see: `https://your-project-name.vercel.app`
   - Click the URL to open your site

2. **Test Your Site**:
   - ✅ Check if the homepage loads
   - ✅ Open browser console (F12) - check for errors
   - ✅ Test API connections
   - ✅ Test authentication/login

3. **Check Build Logs**:
   - Go to **Deployments** tab
   - Click on the latest deployment
   - Review build logs for any warnings

---

## 🔄 Updating Environment Variables After Deployment

If you need to update environment variables later:

1. Go to your project in Vercel Dashboard
2. Click **Settings** (gear icon)
3. Click **Environment Variables** (left sidebar)
4. **Edit** existing variables or **Add New** ones
5. **Important**: After updating, you must **Redeploy**:
   - Go to **Deployments** tab
   - Click **"..."** (three dots) on latest deployment
   - Click **"Redeploy"**
   - Or push a new commit to trigger auto-deployment

---

## 🐛 Troubleshooting

### Issue: Build Fails

**Common Causes:**
- Missing dependencies in `package.json`
- TypeScript errors
- Build command incorrect
- Environment variables missing

**Solution:**
1. Check build logs in Vercel
2. Fix errors locally first (`npm run build`)
3. Push fixes and redeploy

### Issue: Site Loads But API Calls Fail

**Solution:**
1. Check `NEXT_PUBLIC_API_URL` is set correctly
2. Verify backend API is deployed and accessible
3. Check browser console for CORS errors
4. Ensure backend CORS allows your frontend domain

### Issue: Environment Variables Not Working

**Solution:**
1. Verify variable names start with `NEXT_PUBLIC_`
2. Check variable names are exact (case-sensitive)
3. Redeploy after adding/updating variables
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: 404 Errors on Routes

**Solution:**
- This is normal for client-side routing in Next.js
- Vercel handles this automatically
- If issues persist, check your routing configuration

---

## 📝 Example Environment Variables

### For Local Development (`.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### For Production (Vercel):

```
NEXT_PUBLIC_API_URL=https://your-api-project.vercel.app/api
NEXT_PUBLIC_SITE_URL=https://your-frontend-project.vercel.app
```

---

## ✅ Deployment Checklist

Before deploying:
- [ ] Code pushed to Git repository
- [ ] Frontend builds successfully locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] Environment variables prepared

During deployment:
- [ ] Project imported to Vercel
- [ ] Framework preset set to Next.js
- [ ] Root directory configured (if needed)
- [ ] Environment variables added
- [ ] Deploy button clicked

After deployment:
- [ ] Build completed successfully
- [ ] Site accessible at Vercel URL
- [ ] No errors in browser console
- [ ] API connections working
- [ ] Tested key features (login, navigation, etc.)

---

## 🎉 Success!

Your frontend is now deployed! 

**Next Steps:**
1. ✅ Test all features
2. ✅ Update `NEXT_PUBLIC_API_URL` when backend is deployed
3. ✅ Configure custom domain (optional)
4. ✅ Set up preview deployments for branches

---

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 💡 Pro Tips

1. **Automatic Deployments**: Every push to `main` branch auto-deploys
2. **Preview Deployments**: Every pull request gets a preview URL
3. **Custom Domains**: Add your domain in Settings → Domains
4. **Analytics**: Enable Vercel Analytics in Settings
5. **Environment Variables**: Use different values for Production/Preview/Development

---

**Need Help?** Check the build logs in Vercel dashboard for detailed error messages.


