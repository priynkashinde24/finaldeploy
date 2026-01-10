# 🚀 Step-by-Step Guide: Deploy to GitHub Pages

Follow these steps to deploy your Revocart project to GitHub Pages.

## Prerequisites
- ✅ Your code is in a GitHub repository
- ✅ You have push access to the repository
- ✅ Node.js and npm installed locally (for testing)

---

## Step 1: Fix Dynamic Routes Issue (Required)

The dynamic routes need to be fixed for static export. We'll temporarily exclude them from the build.

### Option A: Quick Fix - Exclude Dynamic Routes

Edit `.github/workflows/deploy-pages.yml` and add this step **before** the build step:

```yaml
- name: Remove dynamic routes temporarily
  run: |
    rm -rf frontend/src/app/admin/sessions/\[userId\]
    rm -rf frontend/src/app/stores/\[id\]
    rm -rf frontend/src/app/orders/\[id\]
```

**OR**

### Option B: Keep Routes - They'll work client-side

The routes will work, but you'll get build warnings. The site will still deploy.

---

## Step 2: Commit and Push Your Code

```bash
# Make sure you're in the project root
cd C:\AloneClone

# Add all changes
git add .

# Commit
git commit -m "Setup GitHub Pages deployment"

# Push to GitHub
git push origin main
```

---

## Step 3: Enable GitHub Pages in Repository Settings

1. **Go to your GitHub repository** (e.g., `https://github.com/priynkashinde24/AloneClone-`)

2. **Click on "Settings"** (top menu)

3. **Scroll down to "Pages"** (left sidebar)

4. **Under "Source"**, select:
   - **Source**: `GitHub Actions` (NOT "Deploy from a branch")
   
5. **Click "Save"**

---

## Step 4: Set Environment Variables (Optional but Recommended)

If you have an API deployed separately, set the API URL:

1. In your repository, go to **Settings** → **Secrets and variables** → **Actions**

2. Click **"New repository secret"**

3. Add:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your API URL (e.g., `https://your-api.vercel.app`)

4. Click **"Add secret"**

> **Note**: If you don't have an API yet, you can skip this step and add it later.

---

## Step 5: Trigger the Deployment

The deployment will start automatically when you push to the `main` branch.

### To trigger manually:

1. Go to your repository
2. Click the **"Actions"** tab
3. You should see "Deploy to GitHub Pages" workflow
4. Click **"Run workflow"** → **"Run workflow"** (if needed)

---

## Step 6: Monitor the Deployment

1. **Go to the "Actions" tab** in your repository

2. **Click on the running workflow** (it will say "Deploy to GitHub Pages")

3. **Watch the build process**:
   - ✅ Green checkmark = Success
   - ❌ Red X = Error (check the logs)

4. **Wait for completion** (usually 2-5 minutes)

---

## Step 7: Access Your Deployed Site

Once deployment completes, your site will be available at:

### If your repository is `username/AloneClone-`:
```
https://username.github.io/AloneClone-/
```

### If your repository is `username/username.github.io`:
```
https://username.github.io/
```

> **Note**: It may take a few minutes for the site to be accessible after the first deployment.

---

## Step 8: Update Base Path (If Needed)

If your repository name is NOT `username.github.io`, you need to set the base path:

1. **Edit** `.github/workflows/deploy-pages.yml`

2. **Find this section**:
```yaml
- name: Build for GitHub Pages
  working-directory: ./frontend
  env:
    GITHUB_PAGES: 'true'
    # GITHUB_PAGES_BASE_PATH: '/AloneClone-'
```

3. **Uncomment and update** the base path:
```yaml
    GITHUB_PAGES_BASE_PATH: '/AloneClone-'
```
(Replace `AloneClone-` with your actual repository name)

4. **Commit and push** again:
```bash
git add .github/workflows/deploy-pages.yml
git commit -m "Update base path for GitHub Pages"
git push origin main
```

---

## Troubleshooting

### ❌ Build Fails

**Check the Actions tab for error messages:**

- **"Merge conflict marker encountered"**: Fix merge conflicts in your code
- **"Missing generateStaticParams"**: The dynamic routes issue - use Option A in Step 1
- **"Module not found"**: Check that all dependencies are in `package.json`

### ❌ Site Shows 404

- **Check the base path**: Make sure `GITHUB_PAGES_BASE_PATH` matches your repository name
- **Wait a few minutes**: First deployment can take 5-10 minutes
- **Check the Actions tab**: Make sure deployment completed successfully

### ❌ API Calls Fail

- **Set `NEXT_PUBLIC_API_URL`**: Add it in GitHub Secrets (Step 4)
- **Check CORS**: Make sure your API allows requests from your GitHub Pages domain
- **Verify API is deployed**: Your API must be deployed separately (Vercel, Railway, etc.)

### ❌ Images Not Loading

- This is normal for static export - Next.js image optimization is disabled
- Images in the `public` folder will work fine
- Use regular `<img>` tags instead of Next.js `<Image>` component for dynamic images

---

## Next Steps After Deployment

1. **Deploy your API** (if not done):
   - Vercel: `vercel --prod` from the `api` folder
   - Or use Railway, Render, Heroku, etc.

2. **Update API URL** in GitHub Secrets (Step 4)

3. **Test your site**:
   - Visit the deployed URL
   - Test login/signup
   - Test all features

4. **Set up custom domain** (optional):
   - In repository Settings → Pages → Custom domain
   - Add your domain

---

## Quick Command Reference

```bash
# Test build locally
cd frontend
npm run build:github

# View build output
cd out
npx serve .

# Commit and push
git add .
git commit -m "Your message"
git push origin main

# Check deployment status
# Go to: https://github.com/username/repo/actions
```

---

## ✅ Success Checklist

- [ ] Code pushed to GitHub
- [ ] GitHub Pages enabled (Source: GitHub Actions)
- [ ] Workflow runs successfully in Actions tab
- [ ] Site accessible at `https://username.github.io/repo-name/`
- [ ] API URL set in Secrets (if you have an API)
- [ ] All pages load correctly

---

**Need Help?** Check the error logs in the Actions tab or refer to `GITHUB_PAGES_SETUP.md` for more details.

