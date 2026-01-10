# Troubleshooting 404 Error on GitHub Pages

## Common Causes and Solutions

### 1. ✅ Check Build Completed Successfully

**Go to Actions tab and verify:**
- ✅ Build job completed (green checkmark)
- ✅ Deploy job completed (green checkmark)
- ❌ If build failed, check the error logs

**What to check:**
- Look for "Build for GitHub Pages" step
- Should see "Creating an optimized production build..."
- Should see "✓ Compiled successfully"
- Should see "Export successful"

---

### 2. ✅ Verify Base Path is Correct

**Current setting:** `/AloneClone-2`

**Check:**
1. Go to `.github/workflows/deploy-pages.yml`
2. Line 41 should have: `GITHUB_PAGES_BASE_PATH: '/AloneClone-2'`
3. Make sure it matches your repository name **exactly**

**Your repository:** `priynkashinde24/AloneClone-2`
**Your site URL:** `https://priynkashinde24.github.io/AloneClone-2/`

---

### 3. ✅ Check GitHub Pages Settings

1. Go to: `https://github.com/priynkashinde24/AloneClone-2/settings/pages`
2. **Source** should be: **"GitHub Actions"** (NOT "Deploy from a branch")
3. Should show: "Your site is live at https://priynkashinde24.github.io/AloneClone-2/"

---

### 4. ✅ Verify Build Output

**Check the build logs in Actions:**

Look for the "Verify build output" step:
- Should show `index.html` exists
- Should show files in `out/` directory

**If `out/` is empty or missing:**
- The build didn't complete successfully
- Check for errors in the build step

---

### 5. ✅ Check .nojekyll File

The `.nojekyll` file should be created in `frontend/out/.nojekyll`

**Verify in build logs:**
- Look for ".nojekyll file created" message

---

### 6. ✅ Wait for Propagation

**After deployment:**
- Wait 2-5 minutes for DNS propagation
- Try hard refresh: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
- Clear browser cache

---

### 7. ✅ Check the Correct URL

**Your site should be at:**
```
https://priynkashinde24.github.io/AloneClone-2/
```

**NOT:**
- ❌ `https://priynkashinde24.github.io/AloneClone-2` (no trailing slash)
- ❌ `https://priynkashinde24.github.io/aloneclone-2/` (wrong case)
- ❌ `https://priynkashinde24.github.io/AloneClone-2/index.html` (should redirect)

---

### 8. ✅ Check Build Artifact

**In Actions tab:**
1. Click on the latest successful workflow run
2. Scroll to "Artifacts" section
3. Should see "pages-artifact" with files
4. Download and verify it contains `index.html`

---

## Debugging Steps

### Step 1: Check Build Logs

1. Go to **Actions** tab
2. Click on latest workflow run
3. Click on **"build"** job
4. Check each step:
   - ✅ Checkout
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build for GitHub Pages (check for errors)
   - ✅ Verify build output
   - ✅ Create .nojekyll file
   - ✅ Setup Pages
   - ✅ Upload artifact

### Step 2: Check for Errors

**Common errors:**
- `Error: Page "/stores/[id]/analytics" is missing "generateStaticParams()"`
  - **Solution:** We already added layouts with generateStaticParams
  
- `Error: Build failed`
  - **Solution:** Check the full error message in logs

- `Error: ENOENT: no such file or directory`
  - **Solution:** Check file paths in workflow

### Step 3: Test Build Locally

```bash
cd frontend
npm run build:github
ls -la out/
```

Should see:
- `index.html`
- `_next/` folder
- Other static files

---

## Quick Fixes

### Fix 1: Re-run Workflow

1. Go to **Actions** tab
2. Click **"Deploy to GitHub Pages"**
3. Click **"Run workflow"** → **"Run workflow"**

### Fix 2: Check Repository Name

Make absolutely sure your repository name is exactly `AloneClone-2`:
- Go to repository homepage
- Check the URL: `github.com/priynkashinde24/AloneClone-2`
- Update base path if different

### Fix 3: Clear and Rebuild

1. Delete the workflow run
2. Push a new commit to trigger fresh build
3. Wait for completion

---

## Still Not Working?

**Check these:**
1. ✅ Build completes successfully
2. ✅ Base path matches repository name exactly
3. ✅ Pages source is "GitHub Actions"
4. ✅ `.nojekyll` file is created
5. ✅ `index.html` exists in build output
6. ✅ Waited 5+ minutes after deployment
7. ✅ Using correct URL with trailing slash

**If all above are correct but still 404:**
- Check browser console for errors
- Try incognito/private browsing mode
- Try different browser
- Check if site is actually deployed (Settings → Pages should show URL)

---

## Contact Points

If you've checked everything and it's still not working:
1. Share the build logs from Actions tab
2. Share a screenshot of Pages settings
3. Share the exact URL you're trying to access

