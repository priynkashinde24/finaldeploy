# Frontend Environment Variables - Examples & Templates

## 📋 Required Environment Variables

### 1. API URL (Required)
```env
NEXT_PUBLIC_API_URL=https://your-api-project.vercel.app/api
```

**Purpose:** Backend API endpoint for all API calls

**Example Values:**
- Production: `https://aloneclone-api.vercel.app/api`
- Development: `http://localhost:5000/api`
- Staging: `https://api-staging.vercel.app/api`

---

### 2. Site URL (Required)
```env
NEXT_PUBLIC_SITE_URL=https://your-frontend-project.vercel.app
```

**Purpose:** Frontend site URL for metadata and absolute URLs

**Example Values:**
- Production: `https://aloneclone-frontend.vercel.app`
- Development: `http://localhost:3000`
- Staging: `https://frontend-staging.vercel.app`

---

## 🔑 Optional Token/Secret Variables

### 3. Stripe Public Key (If using Stripe)
```env
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_51AbC123xyz789...
```

**Purpose:** Stripe public key for payment processing

**How to Get:**
1. Go to Stripe Dashboard
2. Developers → API Keys
3. Copy "Publishable key"

---

### 4. Google Analytics ID (If using Analytics)
```env
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

**Purpose:** Google Analytics tracking ID

**How to Get:**
1. Go to Google Analytics
2. Admin → Property Settings
3. Copy Measurement ID

---

### 5. Sentry DSN (If using Error Tracking)
```env
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
```

**Purpose:** Sentry error tracking endpoint

**How to Get:**
1. Go to Sentry Dashboard
2. Settings → Projects → Client Keys (DSN)
3. Copy DSN

---

### 6. Custom API Token (If needed)
```env
NEXT_PUBLIC_API_TOKEN=your-public-api-token-here
```

**Purpose:** Public API token for third-party services

**Note:** Only use for public tokens that are safe to expose in browser

---

## 📝 Complete .env.local Template (Local Development)

Create a file `frontend/.env.local` for local development:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Payment Processing (if using)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51AbC123xyz789...

# Analytics (if using)
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# Error Tracking (if using)
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456

# Custom Tokens (if needed)
NEXT_PUBLIC_API_TOKEN=your-token-here
```

---

## 🔒 Security Guidelines

### ✅ Safe to Add (Public Tokens):
- Stripe Public Keys (`pk_...`)
- Google Analytics IDs
- Public API keys
- Frontend-only tokens
- Third-party service public keys

### ❌ Never Add (Private Secrets):
- JWT Secret Keys
- Database Connection Strings
- Private API Keys (`sk_...`)
- Admin Passwords
- Backend-only secrets

**Rule:** If it's sensitive and should never be in the browser, keep it on the backend only.

---

## 💻 How to Use in Code

### Accessing Environment Variables:

```typescript
// In your React components or pages
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;

// Example usage
const response = await fetch(`${apiUrl}/users`);
```

### Type Safety (Optional):

Create `frontend/src/types/env.d.ts`:

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_SITE_URL: string;
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY?: string;
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?: string;
  }
}
```

---

## 📋 Vercel Setup Checklist

When adding to Vercel:

- [ ] Variable name starts with `NEXT_PUBLIC_`
- [ ] Value is correct (no extra spaces)
- [ ] All environments selected (Production, Preview, Development)
- [ ] Clicked "Save"
- [ ] Redeployed project after adding
- [ ] Tested in browser console

---

## 🎯 Quick Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | ✅ Yes | `https://api.example.com/api` | Backend API |
| `NEXT_PUBLIC_SITE_URL` | ✅ Yes | `https://example.com` | Frontend URL |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | ❌ No | `pk_live_...` | Payments |
| `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | ❌ No | `G-XXXXXXXXXX` | Analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ No | `https://...@...` | Error Tracking |

---

## 🚀 Quick Setup Commands

### For Local Development:

```bash
# Navigate to frontend directory
cd frontend

# Create .env.local file
touch .env.local

# Add your variables (edit the file)
# Then restart dev server
npm run dev
```

### For Vercel:

1. Go to Vercel Dashboard
2. Project → Settings → Environment Variables
3. Add each variable
4. Redeploy

---

**Remember:** Always redeploy after adding environment variables in Vercel!


