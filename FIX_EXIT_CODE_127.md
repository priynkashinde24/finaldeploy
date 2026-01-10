# Fix: Exit Code 127 - Command Not Found

## 🚨 Error: "Command 'npm install && npm run build' exited with 127"

**Exit code 127** means the command was not found. This usually happens when:
1. The `cd api` command fails
2. npm is not in the PATH
3. The command syntax is incorrect

---

## ✅ Solution 1: Set Root Directory to `api` (Recommended)

Instead of using `cd api` in the command, set the root directory:

### Step 1: Update Vercel Settings
1. Go to **Vercel Dashboard → Settings → General**
2. Set **Root Directory** to: `api`
3. **Save**

### Step 2: Update vercel.json
Remove `cd api` from commands since we're already in the `api` folder:

```json
{
  "version": 2,
  "buildCommand": "npm ci && npm run build",
  "installCommand": "npm ci",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index.ts"
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### Step 3: Redeploy

---

## ✅ Solution 2: Fix Command Syntax

If you want to keep root directory as `.`, use this format:

```json
{
  "version": 2,
  "buildCommand": "bash -c 'cd api && npm ci && npm run build'",
  "installCommand": "bash -c 'cd api && npm ci'",
  ...
}
```

---

## ✅ Solution 3: Use api/vercel.json

Create/use `api/vercel.json` with simpler commands:

```json
{
  "version": 2,
  "buildCommand": "npm ci && npm run build",
  "installCommand": "npm ci",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index.ts"
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

Then set Root Directory to `api` in Vercel settings.

---

## 🎯 Recommended Fix (Easiest)

**Set Root Directory to `api`** in Vercel Dashboard:

1. **Vercel Dashboard → Settings → General**
2. **Root Directory**: `api`
3. **Save**
4. **Redeploy**

This way, Vercel will:
- Run commands from the `api/` folder automatically
- Use `api/vercel.json` if it exists
- No need for `cd api` in commands

---

## 📋 Quick Checklist

- [ ] Set Root Directory to `api` in Vercel settings
- [ ] Updated vercel.json (removed `cd api` if root is `api`)
- [ ] Environment variables added
- [ ] Redeployed

---

**Most Common Fix**: Set Root Directory to `api` in Vercel Dashboard! 🎯

