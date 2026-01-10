# 🔴 Fix MongoDB Connection Timeout Error

## Error
```
Operation `users.findOne()` buffering timed out after 10000ms
```

This means MongoDB is not connecting in your Vercel serverless function.

## ✅ Fix Applied

I've updated `api/api/index.ts` to:
1. ✅ Ensure DB connection before handling any requests
2. ✅ Add middleware that waits for DB connection
3. ✅ Better error handling for connection failures
4. ✅ Retry connection on each request if needed

## 🔧 REQUIRED: Set MONGODB_URI in Vercel

### Step 1: Get Your MongoDB Connection String
Your connection string should be:
```
mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
```

**Important:** Make sure the password is URL-encoded:
- `@` becomes `%40`
- `#` becomes `%23`
- etc.

### Step 2: Add to Vercel Environment Variables

1. Go to: **https://vercel.com/dashboard**
2. Select your **Backend Project** (alonecloneweb-application)
3. Go to: **Settings → Environment Variables**
4. Click **"Add New"**
5. Add:
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
   - **Environments**: Production, Preview, Development (select all)
6. Click **Save**

### Step 3: Verify MongoDB Atlas Network Access

1. Go to: **https://cloud.mongodb.com/**
2. Select your cluster
3. Go to: **Network Access**
4. Click **"Add IP Address"**
5. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - This allows Vercel's servers to connect
   - For production, you can restrict to Vercel IPs later
6. Click **Confirm**

### Step 4: Redeploy Backend

After adding the environment variable:

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
   - OR push to GitHub to trigger auto-deploy

## 🧪 Test After Redeploy

### Test 1: Check Ready Endpoint
```
GET https://alonecloneweb-application.vercel.app/ready
```

Should return:
```json
{"status":"ok","db":"connected"}
```

### Test 2: Try Login
After redeploy, try logging in from your frontend. Should work now!

## ⚠️ Common Issues

### Issue 1: "MONGODB_URI is not set"
**Solution:** Make sure you added it in Vercel Environment Variables and redeployed.

### Issue 2: "Authentication failed"
**Solution:** 
- Check password is URL-encoded (`@` → `%40`)
- Verify username/password in MongoDB Atlas → Database Access

### Issue 3: "Network/IP whitelist"
**Solution:** 
- Go to MongoDB Atlas → Network Access
- Add `0.0.0.0/0` to allow all IPs (for Vercel)

### Issue 4: "Connection timeout"
**Solution:**
- Check MongoDB Atlas cluster is running (not paused)
- Verify connection string is correct
- Check Network Access settings

## 📝 Current Configuration

- **Connection String**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
- **Database**: `revocart`
- **Cluster**: `cluster0.mzws36m.mongodb.net`

## ✅ After Fix

- ✅ DB connection established before requests
- ✅ Login should work
- ✅ No more timeout errors
- ✅ Better error messages if connection fails


