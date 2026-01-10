# GitHub Pages Deployment - Quick Fix for Dynamic Routes

## Current Status
✅ GitHub Actions workflow configured
✅ Next.js config updated for static export  
⚠️ Dynamic routes need `generateStaticParams` for static export

## Quick Solution

The dynamic routes (`[id]`, `[userId]`) need special handling. Here are two options:

### Option 1: Skip Dynamic Routes (Simplest)
Edit `.github/workflows/deploy-pages.yml` and add this before the build step:

```yaml
- name: Remove dynamic routes temporarily
  run: |
    rm -rf frontend/src/app/admin/sessions/\[userId\]
    rm -rf frontend/src/app/stores/\[id\]
    rm -rf frontend/src/app/orders/\[id\]
```

### Option 2: Use Catch-All Routes
Convert dynamic routes to catch-all routes `[...slug]` which work better with static export.

## To Deploy:

1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: GitHub Actions

2. **Set API URL (if you have one):**
   - Settings → Secrets → Actions
   - Add `NEXT_PUBLIC_API_URL` with your API URL

3. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages"
   git push origin main
   ```

4. **Monitor deployment:**
   - Go to Actions tab
   - Watch the workflow run
   - Your site will be at: `https://username.github.io/AloneClone-/`

## Note About API
GitHub Pages only serves static files. Your API backend needs to be deployed separately on:
- Vercel (recommended)
- Railway
- Render
- Heroku

Then set `NEXT_PUBLIC_API_URL` to point to your deployed API.

