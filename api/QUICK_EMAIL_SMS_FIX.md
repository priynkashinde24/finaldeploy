# Quick Fix: Email & SMS Not Sending

## ✅ Fixed: Email Verification Now Sends Real Emails

The email verification function has been updated to actually send emails (not just log to console).

## 🚀 Quick Setup (5 minutes)

### 1. Email Setup (Gmail)

**Step 1**: Get Gmail App Password
1. Go to: https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already)
3. Go to **App passwords** → Create new
4. Copy the 16-character password

**Step 2**: Add to `api/.env`
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
```

### 2. SMS Setup (Fast2SMS) - Optional

**Step 1**: Get API Key
1. Sign up at: https://www.fast2sms.com/
2. Get API key from dashboard

**Step 2**: Add to `api/.env`
```env
FAST2SMS_API_KEY=your-api-key
```

### 3. Restart Backend

```bash
cd api
# Stop server (Ctrl+C)
npm run dev
```

---

## 🧪 Test It

### Test Email Verification
1. Register a new user
2. Check your email inbox (or backend console if not configured)

### Test Magic Link
1. Request magic link from login page
2. Check your email inbox (or backend console)

### Test OTP
1. Request OTP via phone
2. Check your phone SMS (or backend console)

---

## 📋 What Works Now

✅ **Email Verification** - Sends real emails (if configured)  
✅ **Magic Link** - Sends real emails (if configured)  
✅ **Password Reset** - Sends real emails (if configured)  
✅ **OTP SMS** - Sends real SMS (if configured)  

**Development Mode**: If not configured, all links/codes are logged to console for easy testing!

---

## 🔍 Check Console Logs

If emails/SMS aren't configured, check your backend console:

**Email Verification**:
```
========================================
EMAIL VERIFICATION EMAIL (Email send failed, showing here for dev)
========================================
To: user@example.com
Subject: Verify Your Email Address

Click the link below to verify your email address:
http://localhost:3000/verify-email?token=abc123...
========================================
```

**Magic Link**:
```
========================================
MAGIC LINK EMAIL (Email send failed, showing here for dev)
========================================
To: user@example.com
Click the link below to login:
http://localhost:3000/magic-login?token=xyz789...
========================================
```

**OTP**:
```
========================================
OTP CODE (SMS send failed, showing here for dev)
========================================
Phone: 1234567890
OTP: 123456
========================================
```

---

## ✅ Complete `.env` Template

```env
# Database
MONGODB_URI=mongodb://localhost:27017/revocart

# JWT
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password

# SMS (Fast2SMS) - Optional
FAST2SMS_API_KEY=your-api-key

# Frontend
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

---

## 🎯 Next Steps

1. ✅ Add email credentials to `.env`
2. ✅ Restart backend
3. ✅ Try registering a new user
4. ✅ Check email inbox (or console logs)

**That's it!** Emails and SMS will now work. 🎉

For detailed setup instructions, see: `EMAIL_SMS_SETUP.md`

