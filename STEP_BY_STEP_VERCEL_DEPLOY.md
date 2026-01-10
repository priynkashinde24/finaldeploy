
# Step-by-Step Vercel Deployment Guide

Follow these steps exactly to deploy your application to Vercel.

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] A Vercel account (sign up at https://vercel.com if needed)
- [ ] A MongoDB Atlas account (free tier at https://www.mongodb.com/cloud/atlas)
- [ ] Node.js installed on your computer
- [ ] Git installed (optional but recommended)

---

## Step 1: Set Up MongoDB Database

### 1.1 Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Try Free"** or **"Sign Up"**
3. Create your account

### 1.2 Create a Cluster
1. After login, click **"Build a Database"**
2. Choose **FREE (M0)** tier
3. Select a cloud provider and region (choose closest to you)
4. Click **"Create"**
5. Wait 3-5 minutes for cluster to be created

### 1.3 Create Database User
1. In the Security section, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Username: `revocart-user` (or your choice)
5. Password: Click **"Autogenerate Secure Password"** and **SAVE IT** (you'll need it!)
6. Database User Privileges: **"Atlas admin"**
7. Click **"Add User"**

### 1.4 Whitelist IP Address
1. In Security section, click **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (for testing - shows `0.0.0.0/0`)
4. Click **"Confirm"**

### 1.5 Get Connection String
1. Click **"Connect"** button on your cluster
2. Choose **"Connect your application"**
3. Driver: **Node.js**, Version: **5.5 or later**
4. Copy the connection string (looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
5. **Replace `<username>` and `<password>`** with your database user credentials
6. **Add database name** at the end: `/revocart?retryWrites=true&w=majority`
7. **SAVE THIS STRING** - you'll need it in Step 4!

**Example final string:**
```
mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority
```

---

## Step 2: Generate JWT Secret Keys

You need two secret keys for authentication. Open PowerShell or Command Prompt and run:

### 2.1 Generate JWT_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Copy the output** - this is your `JWT_SECRET`

### 2.2 Generate JWT_REFRESH_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Copy the output** - this is your `JWT_REFRESH_SECRET` (should be different from JWT_SECRET)

**Save both keys** - you'll need them in Step 4!

---

## Step 3: Install Vercel CLI

### 3.1 Open Terminal/PowerShell
Open PowerShell (Windows) or Terminal (Mac/Linux)

### 3.2 Install Vercel CLI
```bash
npm install -g vercel
```

Wait for installation to complete.

### 3.3 Verify Installation
```bash
vercel --version
```
You should see a version number (e.g., `32.5.0`)

---

## Step 4: Login to Vercel

### 4.1 Login Command
```bash
vercel login
```

### 4.2 Choose Login Method
- Option 1: **Email** - Enter your email, check inbox for magic link
- Option 2: **GitHub** - Opens browser to authorize

### 4.3 Verify Login
You should see: `Success! Authentication complete.`

---

## Step 5: Navigate to Project Directory

### 5.1 Open Terminal in Project Root
Make sure you're in the `C:\AloneClone` directory:

```bash
cd C:\AloneClone
```

### 5.2 Verify You're in Right Place
You should see files like:
- `vercel.json`
- `api/` folder
- `frontend/` folder

---

## Step 6: Deploy to Vercel

### 6.1 Start Deployment
```bash
vercel
```

### 6.2 Answer Prompts

**Prompt 1:** `Set up and deploy "C:\AloneClone"? [Y/n]`
- Type: **Y** and press Enter

**Prompt 2:** `Which scope should contain your project?`
- Select your account (usually just press Enter)

**Prompt 3:** `Link to existing project? [y/N]`
- Type: **N** and press Enter (first time deployment)

**Prompt 4:** `What's your project's name?`
- Type: **revocart** (or your preferred name)
- Press Enter

**Prompt 5:** `In which directory is your code located?`
- Type: **./** (just press Enter - it's the root)

**Prompt 6:** `Want to override the settings? [y/N]`
- Type: **N** and press Enter

### 6.3 Wait for Build
Vercel will:
- Install dependencies
- Build your project
- Deploy to Vercel

This takes 2-5 minutes. **Don't close the terminal!**

### 6.4 Note Your URLs
After deployment, you'll see:
```
✅ Production: https://revocart-xxxxx.vercel.app
```

**COPY THIS URL** - you'll need it in the next step!

---

## Step 7: Set Environment Variables

### 7.1 Open Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click on your project (should be named "revocart")

### 7.2 Navigate to Environment Variables
1. Click **"Settings"** tab (top menu)
2. Click **"Environment Variables"** (left sidebar)

### 7.3 Add Each Variable

Click **"Add New"** for each variable below:

#### Variable 1: MONGODB_URI
- **Key:** `MONGODB_URI`
- **Value:** Paste your MongoDB connection string from Step 1.5
- **Environment:** Select all (Production, Preview, Development)
- Click **"Save"**

#### Variable 2: JWT_SECRET
- **Key:** `JWT_SECRET`
- **Value:** Paste the key from Step 2.1
- **Environment:** Select all
- Click **"Save"**

#### Variable 3: JWT_REFRESH_SECRET
- **Key:** `JWT_REFRESH_SECRET`
- **Value:** Paste the key from Step 2.2
- **Environment:** Select all
- Click **"Save"**

#### Variable 4: FRONTEND_URL
- **Key:** `FRONTEND_URL`
- **Value:** Your Vercel URL from Step 6.4 (e.g., `https://revocart-xxxxx.vercel.app`)
- **Important:** No trailing slash!
- **Environment:** Select all
- Click **"Save"**

#### Variable 5: JWT_EXPIRES_IN (Optional)
- **Key:** `JWT_EXPIRES_IN`
- **Value:** `15m`
- **Environment:** Select all
- Click **"Save"**

#### Variable 6: JWT_REFRESH_EXPIRES_IN (Optional)
- **Key:** `JWT_REFRESH_EXPIRES_IN`
- **Value:** `7d`
- **Environment:** Select all
- Click **"Save"**

#### Variable 7: NODE_ENV (Optional)
- **Key:** `NODE_ENV`
- **Value:** `production`
- **Environment:** Select all
- Click **"Save"**

### 7.4 Verify All Variables
You should see 7 environment variables listed. Double-check:
- ✅ MONGODB_URI
- ✅ JWT_SECRET
- ✅ JWT_REFRESH_SECRET
- ✅ FRONTEND_URL
- ✅ JWT_EXPIRES_IN (optional)
- ✅ JWT_REFRESH_EXPIRES_IN (optional)
- ✅ NODE_ENV (optional)

---

## Step 8: Redeploy with Environment Variables

### 8.1 Option A: Redeploy via CLI
In your terminal (still in `C:\AloneClone`):
```bash
vercel --prod
```

### 8.2 Option B: Redeploy via Dashboard
1. Go to Vercel Dashboard → Your Project
2. Click **"Deployments"** tab
3. Click the **"..."** menu on the latest deployment
4. Click **"Redeploy"**
5. Check **"Use existing Build Cache"** (optional)
6. Click **"Redeploy"**

### 8.3 Wait for Redeployment
Wait 2-5 minutes for the new deployment to complete.

---

## Step 9: Test Your Deployment

### 9.1 Test Health Endpoint
Open your browser and go to:
```
https://your-app.vercel.app/api/health
```

**Expected result:** You should see:
```json
{"status":"ok","message":"API is running"}
```

If you see this, your API is working! ✅

### 9.2 Test Registration
1. Go to: `https://your-app.vercel.app/signup`
2. Fill in the form:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
   - Role: Reseller
3. Click **"Sign Up"**

**Expected result:** Should redirect or show success message ✅

### 9.3 Test Login
1. Go to: `https://your-app.vercel.app/login`
2. Enter:
   - Email: test@example.com
   - Password: password123
3. Click **"Login"**

**Expected result:** Should authenticate and redirect ✅

### 9.4 Check Logs (If Issues)
1. Go to Vercel Dashboard → Your Project
2. Click **"Logs"** tab
3. Look for any errors (red text)
4. Check for "MongoDB Connected" message

---

## Step 10: Share with Client

### 10.1 Get Your Production URL
Your production URL is:
```
https://your-app.vercel.app
```

### 10.2 Share This URL
Send this URL to your client for testing.

### 10.3 Test Checklist for Client
Ask them to test:
- [ ] Can access the website
- [ ] Can create an account
- [ ] Can login
- [ ] Can logout
- [ ] Pages load correctly
- [ ] No error messages

---

## 🎉 Success!

Your application is now deployed on Vercel!

---

## ❌ Troubleshooting

### Problem: "Cannot find module" errors
**Solution:** Make sure all dependencies are in `package.json`. Run:
```bash
cd api
npm install
cd ../frontend
npm install
```

### Problem: API returns 404
**Solution:** 
1. Check `vercel.json` exists in root
2. Check `api/api/index.ts` exists
3. Check build logs in Vercel dashboard

### Problem: Database connection failed
**Solution:**
1. Verify `MONGODB_URI` is correct (check username/password)
2. Check MongoDB Atlas IP whitelist includes `0.0.0.0/0`
3. Verify database user has admin privileges

### Problem: CORS errors
**Solution:**
1. Update `FRONTEND_URL` in environment variables
2. Must match your Vercel URL exactly (no trailing slash)
3. Redeploy after updating

### Problem: JWT errors
**Solution:**
1. Verify both `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
2. Ensure they're different values
3. Must be 32+ characters

---

## 📞 Need Help?

If you get stuck:
1. Check Vercel deployment logs (Dashboard → Logs)
2. Check MongoDB Atlas connection logs
3. Verify all environment variables are set correctly
4. Review error messages carefully

---

## 🔄 Future Deployments

After the first deployment, you can deploy updates easily:

```bash
# From project root
vercel --prod
```

Or push to GitHub and Vercel will auto-deploy (if connected).

---

**That's it! Your app should now be live on Vercel! 🚀**

