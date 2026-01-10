# Backend API Deployment Guide for Vercel

Complete step-by-step guide to deploy your Express.js backend API to Vercel.

---

## 📋 Prerequisites

1. ✅ Your code is in a Git repository (GitHub, GitLab, or Bitbucket)
2. ✅ You have a Vercel account ([vercel.com](https://vercel.com))
3. ✅ Your backend builds successfully locally (`npm run build`)
4. ✅ MongoDB database ready (MongoDB Atlas or self-hosted)
5. ✅ All environment variables prepared

---

## 🚀 Step-by-Step Deployment

### **Step 1: Verify Vercel Configuration**

Your project already has a `vercel.json` file. Verify it exists in `api/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/src/app.ts"
    }
  ]
}
```

✅ This file is already created and configured correctly.

---

### **Step 2: Push Code to Git Repository**

If you haven't already:

```bash
# Navigate to your project root
cd C:\Users\offic\OneDrive\Desktop\priyanka\AloneClone

# Add and commit vercel.json if not already done
git add api/vercel.json
git add .
git commit -m "Add Vercel configuration for API deployment"
git push origin main
```

---

### **Step 3: Import Project to Vercel**

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in or create an account

2. **Import Project**
   - Click **"Add New..."** button (top right)
   - Select **"Project"**
   - Click **"Import Git Repository"**
   - Select your repository
   - Click **"Import"**

---

### **Step 4: Configure Backend Project**

Vercel will try to auto-detect, but you need to configure it manually:

#### **Project Settings:**

1. **Project Name**: 
   - Enter a name (e.g., `aloneclone-api`)
   - This will be your API URL: `https://your-project-name.vercel.app`

2. **Framework Preset**: 
   - Select **"Other"** or **"Node.js"**
   - Don't use Next.js (that's for frontend)

3. **Root Directory**: 
   - Click **"Edit"** next to Root Directory
   - Enter: `api`
   - This tells Vercel where your backend code is

4. **Build and Output Settings**:
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave empty (or `dist` if you want)
   - **Install Command**: `npm install`

5. **Environment Variables** (We'll add these in the next step)

---

### **Step 5: Add Required Environment Variables**

⚠️ **IMPORTANT**: Add these environment variables BEFORE deploying.

1. **Click "Environment Variables"** section (or go to Settings → Environment Variables)

2. **Add Each Variable One by One:**

#### **Variable 1: MongoDB Connection**

- **Click "Add New"**
- **Name**: `MONGODB_URI`
- **Value**: `mongodb+srv://username:password@cluster.mongodb.net/dbname`
  - Replace with your actual MongoDB Atlas connection string
  - Example: `mongodb+srv://admin:password123@cluster0.abc123.mongodb.net/revocart`
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- **Click "Save"**

#### **Variable 2: Frontend URL**

- **Click "Add New"**
- **Name**: `FRONTEND_URL`
- **Value**: `https://your-frontend-project.vercel.app`
  - Replace with your actual frontend URL
  - Example: `https://aloneclone-frontend.vercel.app`
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- **Click "Save"**

#### **Variable 3: JWT Secret**

- **Click "Add New"**
- **Name**: `JWT_SECRET`
- **Value**: `your-random-secret-key-here`
  - Generate a strong random string (at least 32 characters)
  - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`
  - **Never share this secret!**
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- **Click "Save"**

#### **Variable 4: JWT Refresh Secret**

- **Click "Add New"**
- **Name**: `JWT_REFRESH_SECRET`
- **Value**: `your-random-refresh-secret-here`
  - Generate a different strong random string
  - Example: `z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0`
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- **Click "Save"**

#### **Variable 5: Node Environment**

- **Click "Add New"**
- **Name**: `NODE_ENV`
- **Value**: `production`
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☐ Development (leave unchecked, use `development` for local)
- **Click "Save"**

#### **Variable 6: API URL (Optional but Recommended)**

- **Click "Add New"**
- **Name**: `API_URL`
- **Value**: `https://your-api-project.vercel.app`
  - Replace with your actual API project name
  - Example: `https://aloneclone-api.vercel.app`
- **Environments**: 
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- **Click "Save"**

---

### **Step 6: Add Optional Environment Variables**

Add these if you're using these features:

#### **Email Service (If using email):**

```
EMAIL_USER = your-email@gmail.com
EMAIL_PASS = your-app-password
```

#### **SMS Service (If using SMS):**

```
FAST2SMS_API_KEY = your-sms-api-key
```

#### **Encryption Keys (If using encryption):**

```
DATA_ENCRYPTION_KEY = your-encryption-key
PCI_ENCRYPTION_KEY = your-pci-encryption-key
ENCRYPTION_KEY_ID = default-key-v1
```

#### **Port (Usually not needed on Vercel):**

```
PORT = 5000
```
(Note: Vercel auto-assigns ports, but you can set this)

---

### **Step 7: Verify All Variables**

After adding all variables, you should see a list like this:

```
✅ MONGODB_URI
   Production, Preview, Development

✅ FRONTEND_URL
   Production, Preview, Development

✅ JWT_SECRET
   Production, Preview, Development

✅ JWT_REFRESH_SECRET
   Production, Preview, Development

✅ NODE_ENV
   Production, Preview

✅ API_URL
   Production, Preview, Development
```

---

### **Step 8: Deploy**

1. **Review Settings**: Make sure everything looks correct

2. **Click "Deploy"** button (bottom right)

3. **Wait for Build**:
   - Vercel will:
     - Install dependencies (`npm install`)
     - Run build command (`npm run build`)
     - Deploy to production
   - This usually takes 3-5 minutes

4. **Monitor Build Logs**:
   - Watch the build process in real-time
   - Check for any errors or warnings
   - If build fails, check the error messages

---

### **Step 9: Verify Deployment**

1. **Get Your API URL**:
   - After successful deployment, you'll see: `https://your-project-name.vercel.app`
   - Your API will be available at: `https://your-project-name.vercel.app/api`

2. **Test Your API**:
   - Test health endpoint: `https://your-api.vercel.app/api/health` (if you have one)
   - Test a simple endpoint: `https://your-api.vercel.app/api/stores` (if public)
   - Check Vercel function logs for any errors

3. **Check Function Logs**:
   - Go to **Deployments** tab
   - Click on the latest deployment
   - Click **"Functions"** tab
   - Review logs for any errors

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

### **Issue: Build Fails**

**Common Causes:**
- Missing dependencies in `package.json`
- TypeScript errors
- Build command incorrect
- Environment variables missing

**Solution:**
1. Check build logs in Vercel
2. Fix errors locally first (`npm run build`)
3. Push fixes and redeploy

### **Issue: API Returns 500 Errors**

**Solution:**
1. Check Vercel Function Logs (Deployments → Functions → Logs)
2. Verify all required environment variables are set
3. Check MongoDB connection string is correct
4. Verify JWT secrets are set

### **Issue: MongoDB Connection Fails**

**Solution:**
1. Verify `MONGODB_URI` is correct
2. Check MongoDB Atlas IP whitelist (allow all IPs: `0.0.0.0/0`)
3. Verify database user has correct permissions
4. Check connection string format

### **Issue: CORS Errors**

**Solution:**
1. Verify `FRONTEND_URL` is set correctly
2. Check CORS configuration in your Express app
3. Ensure frontend URL matches exactly (no trailing slash)

### **Issue: Environment Variables Not Working**

**Solution:**
1. Verify variable names are exact (case-sensitive)
2. Redeploy after adding/updating variables
3. Check Vercel function logs for errors
4. Ensure variables are set for correct environment (Production/Preview)

---

## 📝 Complete Environment Variables List

### **Required Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `FRONTEND_URL` | Frontend site URL | `https://your-frontend.vercel.app` |
| `JWT_SECRET` | JWT signing secret | `your-random-secret-32-chars-min` |
| `JWT_REFRESH_SECRET` | JWT refresh secret | `your-random-refresh-secret` |
| `NODE_ENV` | Environment | `production` |

### **Optional Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `API_URL` | API base URL | `https://your-api.vercel.app` |
| `PORT` | Server port | `5000` (Vercel auto-assigns) |
| `EMAIL_USER` | Email service user | `your-email@gmail.com` |
| `EMAIL_PASS` | Email service password | `your-app-password` |
| `FAST2SMS_API_KEY` | SMS API key | `your-sms-api-key` |
| `DATA_ENCRYPTION_KEY` | Data encryption key | `your-encryption-key` |
| `PCI_ENCRYPTION_KEY` | PCI encryption key | `your-pci-key` |
| `ENCRYPTION_KEY_ID` | Encryption key ID | `default-key-v1` |

---

## ✅ Deployment Checklist

Before deploying:
- [ ] Code pushed to Git repository
- [ ] `vercel.json` exists in `api/` directory
- [ ] Backend builds successfully locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] MongoDB database ready
- [ ] All environment variables prepared

During deployment:
- [ ] Project imported to Vercel
- [ ] Root directory set to `api`
- [ ] Framework preset set to "Other" or "Node.js"
- [ ] Build command: `npm run build`
- [ ] All required environment variables added
- [ ] Deploy button clicked

After deployment:
- [ ] Build completed successfully
- [ ] API accessible at Vercel URL
- [ ] Tested API endpoints
- [ ] No errors in Vercel function logs
- [ ] MongoDB connection working
- [ ] Frontend can connect to API

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Add them to `.gitignore`
2. **Use strong secrets** - Generate random strings for JWT secrets (at least 32 characters)
3. **Rotate keys regularly** - Especially encryption keys
4. **Use Vercel's encryption** - Vercel encrypts variables at rest
5. **Limit access** - Only add team members who need access
6. **MongoDB Security**:
   - Use strong database passwords
   - Enable IP whitelist in MongoDB Atlas
   - Use connection string with authentication

---

## 💡 Pro Tips

1. **Generate Strong Secrets**:
   ```bash
   # Use Node.js to generate random secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Test Locally First**:
   - Create `.env` file in `api/` directory
   - Test all endpoints locally
   - Fix issues before deploying

3. **Monitor Logs**:
   - Check Vercel function logs regularly
   - Set up error tracking (Sentry, etc.)
   - Monitor API performance

4. **Use Preview Deployments**:
   - Every pull request gets a preview URL
   - Test changes before merging to main

---

## 🎉 Success!

Your backend API is now deployed! 

**Next Steps:**
1. ✅ Test all API endpoints
2. ✅ Update frontend `NEXT_PUBLIC_API_URL` to point to your API
3. ✅ Configure custom domain (optional)
4. ✅ Set up monitoring and error tracking
5. ✅ Document your API endpoints

---

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel build logs
2. Review function logs in Vercel dashboard
3. Verify all environment variables are set
4. Test endpoints with Postman or curl
5. Check MongoDB connection

---

**Remember:** Always redeploy after adding or updating environment variables!


