# How to Add Environment Variables on Vercel

## 📍 Step-by-Step Guide

### Step 1: Go to Your Vercel Project

1. Open [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your **project name** (the one you're deploying)

### Step 2: Navigate to Environment Variables

1. Click on the **"Settings"** tab (top navigation)
2. In the left sidebar, click **"Environment Variables"**

### Step 3: Add Each Variable

For each environment variable:

1. Click **"Add New"** button
2. Enter the **Key** (variable name)
3. Enter the **Value** (variable value)
4. Select which environments to apply to:
   - ✅ **Production** (for production deployments)
   - ✅ **Preview** (for preview deployments)
   - ✅ **Development** (for local development with Vercel CLI)
5. Click **"Save"**

### Step 4: Redeploy

**Important**: After adding environment variables, you must **redeploy** for changes to take effect!

1. Go to **"Deployments"** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**

---

## 🔑 Required Environment Variables

Based on your code, here are the **required** environment variables:

### ✅ Required (Must Have)

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart

# JWT Secrets (for authentication)
JWT_ACCESS_SECRET=your_access_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app

# Node Environment
NODE_ENV=production
```

### 📝 How to Generate JWT Secrets

If you don't have JWT secrets yet, generate them:

**Option 1: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2: Using Online Tool**
- Go to: https://generate-secret.vercel.app/64
- Copy the generated secret

**Option 3: Use Any Random String**
- Any long random string (at least 32 characters)
- Example: `my-super-secret-jwt-key-12345678901234567890`

---

## 📋 Complete Environment Variables List

### Core Variables (Required)

| Variable Name | Example Value | Description |
|--------------|---------------|-------------|
| `MONGODB_URI` | `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart` | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | `your_access_secret_here` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | `your_refresh_secret_here` | Secret for refresh tokens |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | Your frontend URL (for CORS) |
| `NODE_ENV` | `production` | Node environment |

### Optional Variables (If You Use These Features)

| Variable Name | Example Value | Description |
|--------------|---------------|-------------|
| `PAYPAL_CLIENT_ID` | `your_paypal_client_id` | PayPal payment integration |
| `PAYPAL_CLIENT_SECRET` | `your_paypal_secret` | PayPal payment integration |
| `PAYPAL_ENV` | `sandbox` or `live` | PayPal environment |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe payment integration |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe payment integration |
| `SMTP_HOST` | `smtp.gmail.com` | Email service host |
| `SMTP_PORT` | `587` | Email service port |
| `SMTP_USER` | `your_email@gmail.com` | Email service username |
| `SMTP_PASS` | `your_app_password` | Email service password |

---

## 🎯 Quick Copy-Paste Template

Copy this and fill in the values in Vercel:

```
MONGODB_URI=mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
JWT_ACCESS_SECRET=generate-a-random-secret-here
JWT_REFRESH_SECRET=generate-another-random-secret-here
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

---

## ✅ Verification

After adding variables and redeploying:

1. Check deployment logs - should not show "Missing required env vars"
2. Test your API endpoint: `https://your-api.vercel.app/health`
3. Should return: `{ "status": "ok", "message": "API is running" }`

---

## 🔒 Security Tips

1. **Never commit** `.env` files to Git
2. **Use different secrets** for production and development
3. **Rotate secrets** periodically
4. **Don't share** environment variables publicly

---

## 🆘 Troubleshooting

### Error: "Missing required env vars"

**Solution**: 
- Check that all required variables are added
- Make sure they're set for **Production** environment
- Redeploy after adding variables

### Error: "MongoDB connection failed"

**Solution**:
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (should allow `0.0.0.0/0` or Vercel IPs)
- Verify password is URL-encoded (`@` → `%40`)

### Variables not working after adding

**Solution**:
- **Redeploy** your project (variables only apply to new deployments)
- Check that variables are set for the correct environment (Production/Preview)

---

## 📸 Visual Guide

**Path in Vercel Dashboard:**
```
Dashboard → Your Project → Settings → Environment Variables → Add New
```

**What it looks like:**
- **Key**: `MONGODB_URI`
- **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
- **Environments**: ☑ Production ☑ Preview ☑ Development
- **Save** button

---

That's it! Your environment variables are now configured. 🎉

