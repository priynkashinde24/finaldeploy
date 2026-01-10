# Frontend Deployment Quick Reference

## 🚀 Deploy to Vercel in 5 Minutes

### 1. Push to Git
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Import to Vercel
- Go to [vercel.com](https://vercel.com)
- Click "Add New" → "Project"
- Import your repository

### 3. Configure
- **Framework**: Next.js (auto-detected)
- **Root Directory**: `frontend` (if in subdirectory)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 4. Add Environment Variables

**Required:**
```
NEXT_PUBLIC_API_URL = https://your-api.vercel.app/api
NEXT_PUBLIC_SITE_URL = https://your-frontend.vercel.app
```

### 5. Deploy
- Click "Deploy"
- Wait 2-5 minutes
- Your site is live! 🎉

---

## 📝 Environment Variables

All frontend environment variables **must** start with `NEXT_PUBLIC_` to be accessible in the browser.

### Required Variables:
- `NEXT_PUBLIC_API_URL` - Your backend API URL
- `NEXT_PUBLIC_SITE_URL` - Your frontend URL

### How to Add:
1. Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add New → Enter name and value
4. Select environments (Production, Preview, Development)
5. Save → Redeploy

---

## ⚠️ Important Notes

1. **After adding variables**: You MUST redeploy
2. **Variable names**: Case-sensitive, must match exactly
3. **NEXT_PUBLIC_ prefix**: Required for browser access
4. **Update API URL**: When backend is deployed, update `NEXT_PUBLIC_API_URL`

---

## 🐛 Common Issues

**Build fails?**
- Check build logs in Vercel
- Test locally: `npm run build`
- Fix errors and push again

**API not connecting?**
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check backend is deployed
- Check browser console for errors

**Variables not working?**
- Ensure they start with `NEXT_PUBLIC_`
- Redeploy after adding
- Check variable names match exactly

---

## ✅ Quick Checklist

- [ ] Code pushed to Git
- [ ] Project imported to Vercel
- [ ] Environment variables added
- [ ] Deployed successfully
- [ ] Site accessible
- [ ] API connections working

---

**Need help?** See `FRONTEND_DEPLOYMENT_GUIDE.md` for detailed instructions.


