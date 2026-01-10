# GitHub Pages Deployment Guide

This guide will help you deploy your Revocart frontend to GitHub Pages.

## ⚠️ Important Notes

**GitHub Pages only serves static files.** This means:
- ✅ **Frontend (Next.js)** - Can be deployed as static site
- ❌ **API Backend** - Cannot run on GitHub Pages (needs a server)

**Solution**: Deploy your API separately on:
- Vercel (serverless functions)
- Railway
- Render
- Heroku
- Or any Node.js hosting service

## Setup Steps

### 1. Enable GitHub Pages in Repository Settings

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - **Source**: `GitHub Actions` (not "Deploy from a branch")
4. Save the settings

### 2. Configure Base Path (If Needed)

**If your repository is NOT `username.github.io`:**

Your site will be at: `https://username.github.io/AloneClone-/`

You need to set the base path. Edit `.github/workflows/deploy-pages.yml`:

```yaml
- name: Build for GitHub Pages
  working-directory: ./frontend
  env:
    GITHUB_PAGES: 'true'
    GITHUB_PAGES_BASE_PATH: '/AloneClone-'  # Uncomment this line
    NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL || 'https://your-api-url.vercel.app' }}
  run: npm run build:github
```

**If your repository IS `username.github.io`:**

Your site will be at: `https://username.github.io/`

No base path needed - leave `GITHUB_PAGES_BASE_PATH` commented out.

### 3. Set API URL (GitHub Secrets)

Since your API won't be on GitHub Pages, you need to point to your deployed API:

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your API URL (e.g., `https://your-api.vercel.app`)

### 4. Push to GitHub

```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### 5. Monitor Deployment

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You'll see the "Deploy to GitHub Pages" workflow running
4. Wait for it to complete (usually 2-5 minutes)
5. Once done, your site will be live at:
   - `https://username.github.io/AloneClone-/` (if repository is not username.github.io)
   - `https://username.github.io/` (if repository is username.github.io)

## Local Testing

To test the static export locally:

```bash
cd frontend
npm run build:github
npx serve out
```

Visit `http://localhost:3000` (or the port shown)

## Troubleshooting

### Build Fails

- Check the **Actions** tab for error logs
- Ensure all dependencies are in `package.json` (not just `package-lock.json`)
- Verify Node.js version compatibility

### 404 Errors on Navigation

- This is normal for client-side routing in static sites
- GitHub Pages doesn't support Next.js rewrites
- Consider using HashRouter or ensure all routes are pre-rendered

### API Calls Fail

- Verify `NEXT_PUBLIC_API_URL` is set correctly in GitHub Secrets
- Check CORS settings on your API server
- Ensure API is deployed and accessible

### Images Not Loading

- Static export disables Next.js image optimization
- Use regular `<img>` tags or ensure images are in the `public` folder

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
cd frontend
npm run build:github
# The static files will be in frontend/out/
# Upload the contents of 'out' folder to GitHub Pages
```

## Next Steps

1. ✅ Deploy API to Vercel/Railway/Render
2. ✅ Set `NEXT_PUBLIC_API_URL` in GitHub Secrets
3. ✅ Push code to trigger deployment
4. ✅ Test your live site!

