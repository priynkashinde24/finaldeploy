# 🚀 Deploy Your Project to GitHub Pages - Step by Step

Follow these steps to deploy your Revocart project to GitHub Pages.

---

## ✅ Step 1: Make Sure Your Code is Ready

First, let's commit and push all the changes:

```bash
# Open terminal in your project folder (C:\AloneClone)
cd C:\AloneClone

# Check what files changed
git status

# Add all changes
git add .

# Commit
git commit -m "Setup GitHub Pages deployment with Next.js"

# Push to GitHub
git push origin main
```

---

## ✅ Step 2: Configure GitHub Pages Settings

1. **Go to your GitHub repository:**
   - Open: `https://github.com/priynkashinde24/AloneClone-project`

2. **Click on "Settings"** (top menu bar)

3. **Click on "Pages"** (left sidebar)

4. **Under "Source" section:**
   - Select: **"GitHub Actions"** (NOT "Deploy from a branch")
   - ⚠️ **IMPORTANT**: This is the key step! If you select "Deploy from a branch", it will use Jekyll and fail.

5. **Click "Save"**

---

## ✅ Step 3: Trigger the Deployment

The deployment will start automatically when you push code. But you can also trigger it manually:

1. **Go to "Actions" tab** in your repository

2. **Click on "Deploy to GitHub Pages"** workflow (on the left)

3. **Click "Run workflow"** button (top right)
   - Select branch: `main`
   - Click "Run workflow"

---

## ✅ Step 4: Monitor the Build

1. **Watch the workflow run:**
   - You'll see steps like:
     - ✅ Checkout
     - ✅ Setup Node.js
     - ✅ Install dependencies
     - ✅ Build for GitHub Pages
     - ✅ Create .nojekyll file
     - ✅ Setup Pages
     - ✅ Upload artifact
     - ✅ Deploy to GitHub Pages

2. **Wait for completion** (usually 2-5 minutes)

3. **Check for errors:**
   - ✅ Green checkmark = Success!
   - ❌ Red X = Error (check the logs)

---

## ✅ Step 5: Access Your Live Site

Once deployment completes successfully, your site will be available at:

```
https://priynkashinde24.github.io/AloneClone-project/
```

> **Note**: It may take 1-2 minutes after deployment for the site to be accessible.

---

## 🔧 Troubleshooting

### ❌ Build Still Fails

**Check the error in Actions tab:**

1. Click on the failed workflow run
2. Click on the "build" job
3. Look for the error message

**Common issues:**

- **"Missing generateStaticParams"**: The dynamic routes issue. We can fix this by excluding them temporarily.
- **"Module not found"**: Dependencies issue. Make sure `package.json` has all dependencies.
- **"Build failed"**: Check the full error log.

### ❌ Still Using Jekyll

If you still see "pages build and deployment" instead of "Deploy to GitHub Pages":

1. Go to **Settings → Pages**
2. Make sure source is **"GitHub Actions"**
3. Delete the old workflow runs:
   - Actions → "pages build and deployment" → Delete

### ❌ Site Shows 404

- Wait 2-3 minutes (first deployment takes time)
- Check the base path matches your repo name: `/AloneClone-project`
- Verify deployment completed successfully in Actions tab

---

## 📝 Quick Command Reference

```bash
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Your message"

# Push to GitHub
git push origin main

# Check if workflow is running
# Go to: https://github.com/priynkashinde24/AloneClone-project/actions
```

---

## 🎯 What Happens After Deployment

1. **Your Next.js frontend** will be deployed as a static site
2. **All your pages** will be accessible
3. **API calls** will need to point to your deployed API (if you have one)

### Setting Up API (If You Have One)

If you have an API deployed separately (Vercel, Railway, etc.):

1. Go to **Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: Your API URL (e.g., `https://your-api.vercel.app`)
4. Click **"Add secret"**
5. Push again to trigger rebuild

---

## ✅ Success Checklist

- [ ] Code pushed to GitHub
- [ ] GitHub Pages source set to "GitHub Actions"
- [ ] Workflow runs successfully
- [ ] Site accessible at `https://priynkashinde24.github.io/AloneClone-project/`
- [ ] All pages load correctly

---

## 🆘 Need Help?

If something doesn't work:

1. **Check the Actions tab** for error messages
2. **Verify Pages settings** are correct
3. **Check the workflow file** exists: `.github/workflows/deploy-pages.yml`
4. **Make sure `.nojekyll` file** exists in root

---

**That's it!** Once you complete these steps, your site will be live on GitHub Pages. 🎉

