# How to Add JWT Access Token Secrets in .env File

## ✅ Yes, you can add JWT secrets in `.env` file!

For **local development**, you should create a `.env` file in the `api/` folder.

---

## 📝 Step-by-Step Guide

### Step 1: Create `.env` File

1. Go to the `api/` folder in your project
2. Create a new file named `.env` (no extension, just `.env`)
3. **Important**: Make sure `.env` is in your `.gitignore` (it should be already)

### Step 2: Add JWT Secrets

Open the `.env` file and add these lines:

```env
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```

### Step 3: Generate Secure Secrets

**Don't use simple passwords!** Generate secure random secrets:

#### Option 1: Using Node.js (Recommended)

Open terminal in the `api/` folder and run:

```bash
# Generate JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate JWT_REFRESH_SECRET (run again to get a different one)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2
```

#### Option 2: Using Online Generator

1. Go to: https://generate-secret.vercel.app/64
2. Copy the generated secret
3. Use it for `JWT_ACCESS_SECRET`
4. Generate another one for `JWT_REFRESH_SECRET`

#### Option 3: Use Any Long Random String

- Minimum 32 characters
- Can be letters, numbers, symbols
- Example: `my-super-secret-jwt-key-12345678901234567890`

---

## 📄 Complete `.env` File Example

Create `api/.env` with this content:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/revocart

# JWT Secrets (REQUIRED)
JWT_ACCESS_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2
JWT_REFRESH_SECRET=b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

---

## 🔒 Security Notes

### ✅ DO:
- ✅ Use long, random secrets (64+ characters recommended)
- ✅ Use different secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- ✅ Keep `.env` file in `.gitignore`
- ✅ Use different secrets for development and production

### ❌ DON'T:
- ❌ Commit `.env` file to Git
- ❌ Use simple passwords like `password123`
- ❌ Share your secrets publicly
- ❌ Use the same secret for access and refresh tokens

---

## 🧪 Test Your Configuration

After adding the secrets, test if they work:

```bash
cd api
npm run dev
```

You should **NOT** see errors like:
- ❌ `JWT_ACCESS_SECRET is not defined`
- ❌ `Missing required env vars: JWT_ACCESS_SECRET`

---

## 📋 Quick Copy-Paste Template

Copy this and replace the secrets with your generated ones:

```env
MONGODB_URI=mongodb://localhost:27017/revocart
JWT_ACCESS_SECRET=PASTE_YOUR_GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=PASTE_YOUR_OTHER_GENERATED_SECRET_HERE
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🔄 For Vercel Deployment

**Important**: The `.env` file is only for **local development**.

For **Vercel deployment**, you need to add these same variables in:
- Vercel Dashboard → Settings → Environment Variables

See `HOW_TO_ADD_ENV_VARS_VERCEL.md` for detailed instructions.

---

## ✅ Verification Checklist

After creating `.env` file:

- [ ] `.env` file exists in `api/` folder
- [ ] `JWT_ACCESS_SECRET` is added
- [ ] `JWT_REFRESH_SECRET` is added
- [ ] Both secrets are long and random (64+ characters)
- [ ] `.env` is in `.gitignore` (check `api/.gitignore`)
- [ ] Server starts without JWT errors

---

## 🆘 Troubleshooting

### Error: "JWT_ACCESS_SECRET is not defined"

**Solution:**
1. Check that `.env` file exists in `api/` folder
2. Verify the variable name is exactly `JWT_ACCESS_SECRET` (case-sensitive)
3. Make sure there are no spaces: `JWT_ACCESS_SECRET=secret` (not `JWT_ACCESS_SECRET = secret`)
4. Restart your server after adding variables

### Error: "Missing required env vars"

**Solution:**
1. Check that all required variables are in `.env`:
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `MONGODB_URI`
   - `FRONTEND_URL`
2. Make sure there are no typos in variable names

### Secrets Not Loading

**Solution:**
1. Make sure you're running from the `api/` folder
2. Check that `dotenv` package is installed: `npm list dotenv`
3. Restart your development server

---

That's it! Your JWT secrets are now configured in `.env` file! 🎉

