# Step-by-Step: Adding Environment Variables in Vercel Frontend Deployment

This guide shows you exactly how to add environment variables (including tokens and secrets) to your frontend deployment on Vercel.

---

## 🎯 Overview

Environment variables in Vercel are added through the dashboard. For frontend (Next.js), variables that need to be accessible in the browser **must** start with `NEXT_PUBLIC_`.

---

## 📝 Step-by-Step Instructions

### **Step 1: Access Your Project in Vercel**

1. **Go to Vercel Dashboard**
   - Open your browser
   - Navigate to: [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Sign in if needed

2. **Select Your Frontend Project**
   - Find your frontend project in the list
   - Click on the project name to open it

---

### **Step 2: Navigate to Environment Variables**

1. **Click on "Settings"**
   - Look for the **gear icon (⚙️)** or **"Settings"** button
   - It's usually in the top navigation bar or left sidebar
   - Click on it

2. **Find "Environment Variables"**
   - In the left sidebar menu, scroll down
   - Look for **"Environment Variables"**
   - Click on it

   **You should now see:**
   - A list of existing environment variables (if any)
   - An **"Add New"** button (usually at the top right)

---

### **Step 3: Add Your First Environment Variable**

#### **Adding `NEXT_PUBLIC_API_URL`:**

1. **Click "Add New" Button**
   - You'll see a form appear

2. **Fill in the Form:**

   **Variable Name:**
   ```
   NEXT_PUBLIC_API_URL
   ```
   - ⚠️ **Important**: Type this exactly as shown (case-sensitive)
   - Must start with `NEXT_PUBLIC_` to be accessible in browser

   **Value:**
   ```
   https://your-api-project.vercel.app/api
   ```
   - Replace `your-api-project` with your actual API project name
   - Example: `https://aloneclone-api.vercel.app/api`
   - If API not deployed yet: `http://localhost:5000/api` (update later)

3. **Select Environments:**
   - You'll see checkboxes for:
     - ☐ **Production** - For production deployments
     - ☐ **Preview** - For preview deployments (pull requests)
     - ☐ **Development** - For local development
   
   **Check all three:**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

4. **Click "Save"**
   - The variable will be added to your list

---

### **Step 4: Add Your Second Environment Variable**

#### **Adding `NEXT_PUBLIC_SITE_URL`:**

1. **Click "Add New" Button Again**

2. **Fill in the Form:**

   **Variable Name:**
   ```
   NEXT_PUBLIC_SITE_URL
   ```

   **Value:**
   ```
   https://your-frontend-project.vercel.app
   ```
   - Replace `your-frontend-project` with your actual frontend project name
   - Example: `https://aloneclone-frontend.vercel.app`

3. **Select Environments:**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

4. **Click "Save"**

---

### **Step 5: Add Token/Secret Variables (If Needed)**

If your frontend needs to access tokens or secrets (like API keys), add them here:

#### **Example: Adding an API Token:**

1. **Click "Add New"**

2. **Fill in the Form:**

   **Variable Name:**
   ```
   NEXT_PUBLIC_API_TOKEN
   ```
   - ⚠️ Remember: Must start with `NEXT_PUBLIC_` for browser access
   - ⚠️ **Security Note**: Only add tokens that are safe to expose in the browser
   - For sensitive secrets, keep them server-side only

   **Value:**
   ```
   your-actual-token-here-12345
   ```
   - Paste your actual token/secret value
   - Example: `sk_live_abc123xyz789`

3. **Select Environments:**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

4. **Click "Save"**

---

### **Step 6: Add More Variables (If Needed)**

Repeat Step 5 for any additional variables:

**Common Frontend Environment Variables:**

| Variable Name | Example Value | Purpose |
|--------------|---------------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com/api` | Backend API endpoint |
| `NEXT_PUBLIC_SITE_URL` | `https://example.com` | Frontend site URL |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | `pk_live_...` | Stripe public key |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | `G-XXXXXXXXXX` | Google Analytics ID |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@...` | Sentry error tracking |

---

### **Step 7: Verify Your Variables**

After adding all variables, you should see a list like this:

```
✅ NEXT_PUBLIC_API_URL
   Production, Preview, Development
   
✅ NEXT_PUBLIC_SITE_URL
   Production, Preview, Development
   
✅ NEXT_PUBLIC_API_TOKEN (if added)
   Production, Preview, Development
```

---

### **Step 8: Redeploy Your Project**

⚠️ **IMPORTANT**: After adding/updating environment variables, you **MUST** redeploy:

**Option 1: Redeploy from Dashboard**
1. Go to **"Deployments"** tab (top navigation)
2. Find your latest deployment
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Confirm redeployment

**Option 2: Push a New Commit**
1. Make a small change (or just add a comment)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update: Redeploy with new env variables"
   git push origin main
   ```
3. Vercel will automatically redeploy

---

## 🔒 Security Best Practices for Tokens/Secrets

### ✅ Safe to Add (Public Tokens):
- Stripe Public Key (`pk_live_...`)
- Google Analytics ID
- Public API keys
- Frontend-only tokens

### ❌ Never Add (Private Secrets):
- JWT Secret Keys
- Database Passwords
- Private API Keys (`sk_...`)
- Admin Credentials

**Rule of Thumb:**
- If it starts with `NEXT_PUBLIC_`, it will be visible in the browser
- Only add tokens that are meant to be public
- Keep sensitive secrets on the backend only

---

## 📸 Visual Guide (What You'll See)

### **Environment Variables Page:**

```
┌─────────────────────────────────────────────────┐
│  Environment Variables                          │
│                                                 │
│  [Add New]                                      │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ NEXT_PUBLIC_API_URL                       │ │
│  │ Production, Preview, Development          │ │
│  │ [Edit] [Delete]                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ NEXT_PUBLIC_SITE_URL                      │ │
│  │ Production, Preview, Development          │ │
│  │ [Edit] [Delete]                           │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### **Add New Variable Form:**

```
┌─────────────────────────────────────────────────┐
│  Add Environment Variable                       │
│                                                 │
│  Key:                                           │
│  ┌───────────────────────────────────────────┐ │
│  │ NEXT_PUBLIC_API_TOKEN                     │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Value:                                         │
│  ┌───────────────────────────────────────────┐ │
│  │ your-token-value-here                      │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Environments:                                  │
│  ☑ Production                                   │
│  ☑ Preview                                      │
│  ☑ Development                                  │
│                                                 │
│  [Cancel]  [Save]                               │
└─────────────────────────────────────────────────┘
```

---

## ✅ Complete Checklist

Use this checklist to ensure you've done everything:

- [ ] Opened Vercel Dashboard
- [ ] Selected your frontend project
- [ ] Navigated to Settings → Environment Variables
- [ ] Added `NEXT_PUBLIC_API_URL` with correct value
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Saved the variable
- [ ] Added `NEXT_PUBLIC_SITE_URL` with correct value
- [ ] Selected all environments
- [ ] Saved the variable
- [ ] Added any additional tokens/secrets (if needed)
- [ ] Verified all variables are listed correctly
- [ ] Redeployed the project
- [ ] Tested the deployment

---

## 🐛 Troubleshooting

### **Problem: Variable Not Showing Up**

**Solution:**
- Check variable name starts with `NEXT_PUBLIC_`
- Verify you clicked "Save"
- Refresh the page
- Check if you're looking at the correct project

### **Problem: Variable Not Working After Deployment**

**Solution:**
- Did you redeploy after adding variables? (Required!)
- Check variable name is exact (case-sensitive)
- Verify value is correct (no extra spaces)
- Check browser console for errors
- Clear browser cache and hard refresh

### **Problem: Can't See "Environment Variables" Option**

**Solution:**
- Make sure you're in the project Settings page
- Check you have proper permissions (project owner/admin)
- Try refreshing the page
- Check if you're in the correct project

### **Problem: Token/Secret Not Accessible in Code**

**Solution:**
- Variable must start with `NEXT_PUBLIC_` for browser access
- Access it as: `process.env.NEXT_PUBLIC_YOUR_VARIABLE`
- Restart dev server if testing locally
- Redeploy after adding variables

---

## 💡 Pro Tips

1. **Use Different Values for Different Environments:**
   - Production: `https://api.production.com`
   - Preview: `https://api.staging.com`
   - Development: `http://localhost:5000`

2. **Keep a Backup:**
   - Document all environment variables in a secure place
   - Use a password manager for sensitive values

3. **Test Locally First:**
   - Create `.env.local` file for local testing
   - Test before deploying

4. **Use Vercel CLI (Advanced):**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL
   ```

---

## 📚 Example: Complete Setup

Here's what your environment variables should look like:

```
✅ NEXT_PUBLIC_API_URL
   Value: https://aloneclone-api.vercel.app/api
   Environments: Production, Preview, Development

✅ NEXT_PUBLIC_SITE_URL
   Value: https://aloneclone-frontend.vercel.app
   Environments: Production, Preview, Development

✅ NEXT_PUBLIC_STRIPE_PUBLIC_KEY (if using Stripe)
   Value: pk_live_51AbC123...
   Environments: Production, Preview, Development
```

---

## 🎉 You're Done!

After following these steps:
1. ✅ All environment variables are added
2. ✅ Project is redeployed
3. ✅ Variables are accessible in your code
4. ✅ Frontend is working correctly

**Next Steps:**
- Test your deployment
- Verify API connections work
- Check browser console for any errors
- Update variables as needed

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel build logs
2. Review browser console errors
3. Verify variable names and values
4. Check Vercel documentation: [vercel.com/docs/environment-variables](https://vercel.com/docs/environment-variables)

---

**Remember:** Always redeploy after adding or updating environment variables!

