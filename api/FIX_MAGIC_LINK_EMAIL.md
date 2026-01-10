# Fix: Magic Link Email Not Sending

## 🔍 Quick Diagnosis

The magic link email is not being sent because email credentials are not configured. Here's how to fix it:

---

## ✅ Solution 1: Set Up Gmail (Recommended)

### Step 1: Get Gmail App Password

1. Go to: https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already enabled)
3. Scroll down to **App passwords**
4. Click **Select app** → Choose **Mail**
5. Click **Select device** → Choose **Other (Custom name)**
6. Enter: "Revocart API"
7. Click **Generate**
8. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)

### Step 2: Add to `.env` File

In your `api/.env` file, add:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Important**:
- Use your **Gmail address** for `EMAIL_USER`
- Use the **16-character app password** (NOT your regular Gmail password)
- Remove spaces from the app password if it has them

### Step 3: Restart Backend

```bash
cd api
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Test Magic Link

1. Request magic link from login page
2. Check your email inbox
3. Should receive email with magic link

---

## 🔍 Solution 2: Check Console Logs (Development Mode)

If you haven't set up email yet, the magic link URL is **logged to console** in development mode.

### Check Backend Console

When you request a magic link, look for this in your backend terminal:

```
========================================
MAGIC LINK EMAIL (Email send failed, showing here for dev)
========================================
To: your-email@example.com
Subject: Your Magic Login Link

Click the link below to login:
http://localhost:3000/magic-login?token=abc123...

This link expires in 15 minutes and can only be used once.
========================================
```

**Copy the URL** and paste it in your browser to login!

---

## 🧪 Test Email Configuration

### Test 1: Check Environment Variables

```bash
cd api
# Check if variables are set
echo $EMAIL_USER
echo $EMAIL_PASS
```

Or check your `.env` file:
```bash
cat .env | grep EMAIL
```

### Test 2: Test Email Sending

```bash
curl -X POST http://localhost:5000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

**Check**:
- Backend console for email content (if not configured)
- Your email inbox (if configured)

---

## 🐛 Troubleshooting

### Error: "EMAIL_USER and EMAIL_PASS environment variables are required"

**Fix**: 
1. Check `.env` file exists in `api/` folder
2. Check variables are set correctly
3. Restart backend after adding variables

### Error: "Invalid login" or "Authentication failed"

**Fix**:
1. Make sure you're using **App Password** (not regular password)
2. Make sure 2-Step Verification is enabled
3. Check email address is correct

### Error: "Connection timeout"

**Fix**:
1. Check internet connection
2. Check firewall isn't blocking SMTP (port 587)
3. Try using a different email provider

### Email Not in Inbox

**Check**:
1. **Spam/Junk folder** - Gmail might mark it as spam initially
2. **Promotions tab** - Check Gmail's Promotions tab
3. **Backend console** - Check for error messages
4. **Email address** - Make sure you're checking the correct email

---

## 📋 Complete `.env` Example

```env
# Database
MONGODB_URI=mongodb://localhost:27017/revocart

# JWT Secrets
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcdefghijklmnop

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

---

## 🎯 Quick Checklist

- [ ] Gmail 2-Step Verification enabled
- [ ] App Password created
- [ ] `EMAIL_USER` set in `.env`
- [ ] `EMAIL_PASS` set in `.env` (16-character app password)
- [ ] Backend restarted
- [ ] Test magic link request
- [ ] Check email inbox (and spam folder)
- [ ] Check backend console for errors

---

## 💡 Alternative: Use Console Logs (Development)

If you don't want to set up email right now:

1. Request magic link
2. Check backend console
3. Copy the magic link URL from console
4. Paste in browser to login

**The URL looks like**:
```
http://localhost:3000/magic-login?token=abc123xyz789...
```

---

## 🚀 Production Setup

For production, consider using:
- **SendGrid** (more reliable than Gmail)
- **Mailgun** (good for transactional emails)
- **AWS SES** (scalable)

Update `api/src/utils/mailer.ts` to use these providers.

---

## ✅ After Setup

1. **Request magic link** from login page
2. **Check email inbox** (and spam folder)
3. **Click magic link** to login
4. **Should work immediately!**

---

**Most common issue**: Not using App Password (using regular Gmail password instead).

**Quick fix**: Get App Password from Google Account settings and use that in `.env` file.

