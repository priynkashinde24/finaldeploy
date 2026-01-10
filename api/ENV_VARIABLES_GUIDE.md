# Backend Environment Variables Guide

Complete list of all environment variables needed for the backend API deployment.

---

## 🔴 Required Environment Variables

These variables **MUST** be set for the API to work:

### 1. MongoDB Connection
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

**How to Get:**
1. Go to MongoDB Atlas
2. Clusters → Connect → Connect your application
3. Copy connection string
4. Replace `<password>` with your database password
5. Replace `<dbname>` with your database name

**Example:**
```
MONGODB_URI=mongodb+srv://admin:MyPassword123@cluster0.abc123.mongodb.net/revocart?retryWrites=true&w=majority
```

---

### 2. Frontend URL
```env
FRONTEND_URL=https://your-frontend-project.vercel.app
```

**Purpose:** Used for CORS configuration and redirects

**Example:**
```
FRONTEND_URL=https://aloneclone-frontend.vercel.app
```

---

### 3. JWT Secret
```env
JWT_SECRET=your-random-secret-key-here
```

**Purpose:** Secret key for signing JWT access tokens

**How to Generate:**
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator
# Generate at least 32 characters
```

**Example:**
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**⚠️ Security:** Never share this secret! Keep it private.

---

### 4. JWT Refresh Secret
```env
JWT_REFRESH_SECRET=your-random-refresh-secret-here
```

**Purpose:** Secret key for signing JWT refresh tokens

**How to Generate:**
- Generate a different random string (different from JWT_SECRET)
- Use the same method as JWT_SECRET

**Example:**
```
JWT_REFRESH_SECRET=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4
```

---

### 5. Node Environment
```env
NODE_ENV=production
```

**Purpose:** Sets the application environment

**Values:**
- `production` - For production deployments
- `development` - For local development
- `test` - For testing

---

## 🟡 Optional but Recommended

### 6. API URL
```env
API_URL=https://your-api-project.vercel.app
```

**Purpose:** API base URL for internal references

**Example:**
```
API_URL=https://aloneclone-api.vercel.app
```

---

### 7. Port
```env
PORT=5000
```

**Note:** Vercel auto-assigns ports, but you can set this for consistency.

---

## 🟢 Optional (Feature-Specific)

### Email Service (If using email)

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**How to Get Gmail App Password:**
1. Go to Google Account Settings
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate
4. Copy the generated password

---

### SMS Service (If using SMS)

```env
FAST2SMS_API_KEY=your-sms-api-key
```

**How to Get:**
1. Sign up at Fast2SMS
2. Go to API section
3. Copy your API key

---

### Encryption Keys (If using encryption)

```env
DATA_ENCRYPTION_KEY=your-encryption-key-here
PCI_ENCRYPTION_KEY=your-pci-encryption-key-here
ENCRYPTION_KEY_ID=default-key-v1
```

**How to Generate:**
- Use the same method as JWT secrets
- Generate strong random strings (32+ characters)

---

## 📝 Complete .env Template (Local Development)

Create `api/.env` for local development:

```env
# Required
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/revocart
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-dev-jwt-secret-here
JWT_REFRESH_SECRET=your-dev-refresh-secret-here

# Optional
API_URL=http://localhost:5000
PORT=5000

# Email (if using)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# SMS (if using)
FAST2SMS_API_KEY=your-sms-api-key

# Encryption (if using)
DATA_ENCRYPTION_KEY=your-dev-encryption-key
PCI_ENCRYPTION_KEY=your-dev-pci-key
ENCRYPTION_KEY_ID=default-key-v1
```

---

## 🔒 Security Checklist

- [ ] All secrets are strong random strings (32+ characters)
- [ ] JWT_SECRET and JWT_REFRESH_SECRET are different
- [ ] MongoDB password is strong
- [ ] Never commit `.env` file to Git
- [ ] Use different values for Production vs Development
- [ ] Rotate keys regularly
- [ ] Limit access to environment variables

---

## 📋 Vercel Setup Checklist

When adding to Vercel:

- [ ] Variable name is exact (case-sensitive)
- [ ] Value is correct (no extra spaces)
- [ ] All required variables added
- [ ] Production environment selected
- [ ] Preview environment selected (optional)
- [ ] Development environment selected (optional)
- [ ] Clicked "Save" for each variable
- [ ] Redeployed after adding variables

---

## 🎯 Quick Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URI` | ✅ Yes | `mongodb+srv://...` | Database connection |
| `FRONTEND_URL` | ✅ Yes | `https://frontend.vercel.app` | CORS & redirects |
| `JWT_SECRET` | ✅ Yes | `random-32-chars` | JWT signing |
| `JWT_REFRESH_SECRET` | ✅ Yes | `random-32-chars` | Refresh tokens |
| `NODE_ENV` | ✅ Yes | `production` | Environment |
| `API_URL` | ⚠️ Recommended | `https://api.vercel.app` | API base URL |
| `EMAIL_USER` | ❌ Optional | `email@gmail.com` | Email service |
| `EMAIL_PASS` | ❌ Optional | `app-password` | Email service |
| `FAST2SMS_API_KEY` | ❌ Optional | `api-key` | SMS service |

---

## 🚀 Quick Setup Commands

### Generate Secrets:

```bash
# Generate JWT_SECRET
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_REFRESH_SECRET
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate Encryption Keys
node -e "console.log('DATA_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

**Remember:** Always redeploy after adding environment variables in Vercel!

