# Quick Guide: Adding Environment Variables in Vercel

## 🎯 Quick Steps

### For Frontend Project:

1. **Go to Vercel Dashboard** → Select your **Frontend Project**
2. Click **Settings** (gear icon)
3. Click **Environment Variables** (left sidebar)
4. Click **"Add New"** button
5. Add these variables:

#### Required Variables:

```
Variable Name: NEXT_PUBLIC_API_URL
Value: https://your-api-project.vercel.app/api
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Variable Name: NEXT_PUBLIC_SITE_URL
Value: https://your-frontend-project.vercel.app
Environments: ☑ Production ☑ Preview ☑ Development
```

6. Click **"Save"** for each variable
7. **Redeploy** your project (or push a new commit)

---

### For Backend API Project:

1. **Go to Vercel Dashboard** → Select your **API Project**
2. Click **Settings** → **Environment Variables**
3. Click **"Add New"** button
4. Add these variables (one by one):

#### Essential Variables:

```
NODE_ENV = production
MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/dbname
JWT_SECRET = your-random-secret-key-here
JWT_REFRESH_SECRET = your-random-refresh-secret-here
FRONTEND_URL = https://your-frontend-project.vercel.app
API_URL = https://your-api-project.vercel.app
```

#### Optional but Recommended:

```
EMAIL_USER = your-email@gmail.com
EMAIL_PASS = your-app-password
FAST2SMS_API_KEY = your-sms-api-key
DATA_ENCRYPTION_KEY = your-encryption-key
PCI_ENCRYPTION_KEY = your-pci-encryption-key
ENCRYPTION_KEY_ID = default-key-v1
```

5. For each variable:
   - Select environments: **Production**, **Preview**, **Development**
   - Click **"Save"**
6. **Redeploy** your API project

---

## ⚠️ Important Notes:

1. **Variable Names are Case-Sensitive**: `NEXT_PUBLIC_API_URL` ≠ `next_public_api_url`

2. **Frontend Variables Must Start with `NEXT_PUBLIC_`**: 
   - ✅ `NEXT_PUBLIC_API_URL` (accessible in browser)
   - ❌ `API_URL` (NOT accessible in browser)

3. **After Adding Variables**: 
   - You MUST redeploy for changes to take effect
   - Or push a new commit to trigger auto-deployment

4. **Security**:
   - Never commit `.env` files to Git
   - Use strong, random strings for secrets
   - Rotate keys regularly

---

## 🔍 How to Verify Variables Are Set:

### Frontend:
1. Deploy your frontend
2. Open browser console
3. Check if API calls are working
4. Check Network tab for API requests

### Backend:
1. Check Vercel Function Logs
2. Test an API endpoint
3. Check for environment-related errors in logs

---

## 📝 Example Values:

### Development (Local):
```
NEXT_PUBLIC_API_URL = http://localhost:5000/api
NEXT_PUBLIC_SITE_URL = http://localhost:3000
```

### Production (Vercel):
```
NEXT_PUBLIC_API_URL = https://your-api.vercel.app/api
NEXT_PUBLIC_SITE_URL = https://your-frontend.vercel.app
```

---

## 🆘 Troubleshooting:

**Problem**: Variables not working after deployment

**Solution**: 
- Check variable names match exactly
- Ensure you selected the correct environment (Production/Preview/Development)
- Redeploy after adding variables
- Check Vercel build logs for errors

**Problem**: Frontend can't connect to API

**Solution**:
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is deployed and accessible
- Ensure CORS is configured in backend
- Check browser console for CORS errors

---

## ✅ Checklist:

- [ ] Frontend environment variables added
- [ ] Backend environment variables added
- [ ] All variables saved with correct environments selected
- [ ] Projects redeployed after adding variables
- [ ] Tested frontend → backend connection
- [ ] Verified no errors in Vercel logs

