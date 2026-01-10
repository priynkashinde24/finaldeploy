# Email & SMS Setup Guide

## 🔧 Problem: Emails and SMS Not Sending

Your emails and SMS are not being sent because the required environment variables are not configured.

## 📧 Email Setup (Gmail)

### Step 1: Enable Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** → **2-Step Verification** (enable if not already)
3. Scroll down and click **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Enter name: "Revocart API"
6. Click **Generate**
7. **Copy the 16-character password** (you'll need this)

### Step 2: Add to `.env` File

In your `api/.env` file, add:

```env
# Gmail SMTP Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
```

**Important**: 
- Use your **Gmail address** for `EMAIL_USER`
- Use the **16-character app password** (not your regular Gmail password)
- The app password looks like: `abcd efgh ijkl mnop`

### Step 3: Test Email

Restart your backend and try:
- Register a new user → Should send verification email
- Request magic link → Should send magic link email
- Request password reset → Should send reset email

---

## 📱 SMS Setup (Fast2SMS)

### Step 1: Get Fast2SMS API Key

1. Go to [Fast2SMS](https://www.fast2sms.com/)
2. Sign up for a free account
3. Go to **Dashboard** → **API Keys**
4. Copy your API key

### Step 2: Add to `.env` File

In your `api/.env` file, add:

```env
# Fast2SMS Configuration
FAST2SMS_API_KEY=your-api-key-here
```

### Step 3: Test SMS

Restart your backend and try:
- Request OTP via phone → Should send SMS with OTP code

---

## 🧪 Development Mode (Console Logging)

If you don't want to set up email/SMS right now, the code will **log to console** in development mode:

### Email (Magic Link / Verification)
When email fails, check your backend console:
```
========================================
MAGIC LINK EMAIL (Email send failed, showing here for dev)
========================================
To: user@example.com
Subject: Your Magic Login Link

Click the link below to login:
http://localhost:3000/magic-login?token=abc123...

This link expires in 15 minutes and can only be used once.
========================================
```

### SMS (OTP)
When SMS fails, check your backend console:
```
========================================
OTP CODE (SMS send failed, showing here for dev)
========================================
Phone: 1234567890
OTP: 123456

Your verification code is: 123456
This code expires in 5 minutes.
========================================
⚠️  To send OTP via SMS, set FAST2SMS_API_KEY in .env
========================================
```

---

## ✅ Complete `.env` Example

```env
# Database
MONGODB_URI=mongodb://localhost:27017/revocart

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password

# SMS (Fast2SMS)
FAST2SMS_API_KEY=your-fast2sms-api-key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

---

## 🔍 Troubleshooting

### Email Not Sending

**Error**: `EMAIL_USER and EMAIL_PASS environment variables are required`

**Fix**: 
1. Check `.env` file exists in `api/` folder
2. Check variables are set correctly
3. Restart backend after adding variables

**Error**: `Invalid login` or `Authentication failed`

**Fix**:
1. Make sure you're using **App Password** (not regular password)
2. Make sure 2-Step Verification is enabled
3. Check email address is correct

**Error**: `Connection timeout`

**Fix**:
1. Check internet connection
2. Check firewall isn't blocking SMTP (port 587)
3. Try using a different email provider

### SMS Not Sending

**Error**: `FAST2SMS_API_KEY environment variable is not set`

**Fix**:
1. Add `FAST2SMS_API_KEY` to `.env`
2. Restart backend

**Error**: `Invalid phone number format`

**Fix**:
- Phone must be 10 digits (Indian numbers)
- Format: `1234567890` (no country code, no spaces)

**Error**: `SMS API error`

**Fix**:
1. Check Fast2SMS account has credits
2. Verify API key is correct
3. Check phone number format

---

## 🎯 Quick Test

### Test Email (Magic Link)

```bash
curl -X POST http://localhost:5000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

**Check**:
- Backend console for email content (if not configured)
- Your email inbox (if configured)

### Test SMS (OTP)

```bash
curl -X POST http://localhost:5000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890"}'
```

**Check**:
- Backend console for OTP code (if not configured)
- Your phone SMS (if configured)

---

## 📝 Alternative Email Providers

If you don't want to use Gmail, you can modify `api/src/utils/mailer.ts`:

### SendGrid
```typescript
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});
```

### Mailgun
```typescript
const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS,
  },
});
```

### Outlook/Hotmail
```typescript
const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
```

---

## 🚀 Production Setup

For production, use:
- **SendGrid** or **Mailgun** (more reliable than Gmail)
- **Twilio** or **AWS SNS** for SMS (more reliable than Fast2SMS)

Update environment variables in your hosting platform (Vercel, Render, etc.)

---

## ✅ Checklist

- [ ] Gmail App Password created
- [ ] `EMAIL_USER` set in `.env`
- [ ] `EMAIL_PASS` set in `.env`
- [ ] Fast2SMS account created
- [ ] `FAST2SMS_API_KEY` set in `.env`
- [ ] Backend restarted
- [ ] Test email sent successfully
- [ ] Test SMS sent successfully

---

**After setting up, restart your backend and try again!** 🎉

