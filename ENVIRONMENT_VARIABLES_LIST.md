# Environment Variables to Add in Vercel

## 🔴 REQUIRED - Backend (Must Add These)

Add these in your **Backend Project** → Settings → Environment Variables:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` | Your MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` | `your-random-secret-key-here` | Secret for JWT access tokens (use a long random string) |
| `JWT_REFRESH_SECRET` | `your-random-refresh-secret-here` | Secret for JWT refresh tokens (use a different long random string) |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | Your frontend URL (update after frontend deploys) |
| `PORT` | `5000` | Server port (optional, defaults to 5000) |

---

## 🟡 OPTIONAL - Backend (Add Only If Using These Features)

### Payment Gateways

| Key | Value | When to Add |
|-----|-------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | If using Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | If using Stripe webhooks |
| `RAZORPAY_KEY_ID` | `rzp_test_...` or `rzp_live_...` | If using Razorpay payments |
| `RAZORPAY_KEY_SECRET` | `your_razorpay_secret` | If using Razorpay payments |
| `RAZORPAY_WEBHOOK_SECRET` | `your_webhook_secret` | If using Razorpay webhooks |

### Email Service

| Key | Value | When to Add |
|-----|-------|-------------|
| `EMAIL_USER` | `your-email@gmail.com` | If sending emails |
| `EMAIL_PASS` | `your-app-password` | If sending emails (use Gmail App Password) |

### SMS Service

| Key | Value | When to Add |
|-----|-------|-------------|
| `FAST2SMS_API_KEY` | `your_api_key` | If sending SMS messages |

### Security

| Key | Value | When to Add |
|-----|-------|-------------|
| `ADMIN_WHITELIST_IPS` | `127.0.0.1,192.168.1.1` | Comma-separated IPs for admin access |
| `VERCEL_FRONTEND_URL` | `https://your-frontend.vercel.app` | Alternative frontend URL for CORS |

---

## 🔴 REQUIRED - Frontend (Must Add These)

Add these in your **Frontend Project** → Settings → Environment Variables:

| Key | Value | Description |
|-----|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.vercel.app` | Your backend API URL (get this after backend deploys) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-frontend.vercel.app` | Your frontend URL (will be assigned after first deploy) |
| `NODE_ENV` | `production` | Environment mode |

---

## 📝 How to Generate Secrets

### JWT Secrets (Required)
Generate random strings for JWT secrets. You can use:

**Option 1: Online Generator**
- Visit: https://randomkeygen.com/
- Use "CodeIgniter Encryption Keys" - copy a 32+ character string

**Option 2: Terminal/Command Prompt**
```bash
# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example:**
- `JWT_ACCESS_SECRET`: `a8f5f167f44f4964e6c998dee827110c8f5f167f44f4964e6c998dee827110c`
- `JWT_REFRESH_SECRET`: `b9e6e278g55g5075f7d009eff938221d9e6e278g55g5075f7d009eff938221d` (different from access secret)

---

## ✅ Quick Checklist

### Backend Variables:
- [ ] `NODE_ENV` = `production`
- [ ] `MONGODB_URI` = Your MongoDB connection string
- [ ] `JWT_ACCESS_SECRET` = Random secret (32+ characters)
- [ ] `JWT_REFRESH_SECRET` = Different random secret (32+ characters)
- [ ] `FRONTEND_URL` = Your frontend URL (after it deploys)
- [ ] `PORT` = `5000` (optional)

### Frontend Variables:
- [ ] `NEXT_PUBLIC_API_URL` = Your backend URL (after backend deploys)
- [ ] `NEXT_PUBLIC_SITE_URL` = Your frontend URL (after frontend deploys)
- [ ] `NODE_ENV` = `production`

---

## 🚨 Important Notes

1. **Never commit `.env` files** - Vercel handles this securely
2. **Values are encrypted** - Once saved, values are hidden for security
3. **Redeploy after adding variables** - Changes only take effect after redeployment
4. **`NEXT_PUBLIC_*` variables are public** - Never put secrets in variables starting with `NEXT_PUBLIC_`
5. **Update URLs after deployment** - You'll need to update `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` with actual URLs after first deploy

---

## 🔄 Deployment Order

1. **Deploy Backend first** → Get backend URL
2. **Add backend URL to Frontend** → Set `NEXT_PUBLIC_API_URL`
3. **Deploy Frontend** → Get frontend URL
4. **Update Backend** → Set `FRONTEND_URL` with frontend URL
5. **Redeploy Backend** → For CORS to work correctly

