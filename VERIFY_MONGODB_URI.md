# 🔍 Verify MONGODB_URI is Set in Vercel

## Current Error
```
Operation `users.findOne()` buffering timed out after 10000ms
```

This means **MongoDB is NOT connected**. The most common cause is **MONGODB_URI environment variable is not set in Vercel**.

## ✅ Step-by-Step Verification

### Step 1: Check Vercel Environment Variables

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your **Backend Project**: `alonecloneweb-application`

2. **Check Environment Variables**
   - Click **Settings** (top menu)
   - Click **Environment Variables** (left sidebar)
   - Look for `MONGODB_URI` in the list

3. **If MONGODB_URI is NOT there:**
   - Click **"Add New"**
   - **Key**: `MONGODB_URI`
   - **Value**: `mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart`
   - **Environments**: Select ALL (Production, Preview, Development)
   - Click **Save**

4. **If MONGODB_URI IS there:**
   - Click on it to edit
   - Verify the value is correct
   - Make sure it's enabled for **Production** environment
   - Click **Save**

### Step 2: Verify Value Format

The connection string should be:
```
mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart
```

**Important:**
- ✅ Starts with `mongodb+srv://`
- ✅ Password is URL-encoded: `%40` (not `@`)
- ✅ Includes database name: `/revocart`
- ✅ No spaces or line breaks
- ✅ All on one line

### Step 3: Redeploy After Adding/Updating

**After adding or updating MONGODB_URI, you MUST redeploy:**

**Option A: Push to GitHub**
```bash
git add .
git commit -m "Update MongoDB connection"
git push origin main
```

**Option B: Manual Redeploy**
1. Go to Vercel Dashboard → Your Backend Project
2. Click **Deployments** tab
3. Click **"..."** on latest deployment
4. Click **"Redeploy"**
5. Wait for deployment to complete

### Step 4: Check Vercel Logs

1. Go to Vercel Dashboard → Your Backend Project
2. Click **Logs** tab
3. Look for:
   - ✅ `✅ Database connected successfully` = Good!
   - ❌ `❌ MONGODB_URI environment variable is not set!` = Not set
   - ❌ `❌ Failed to connect to database` = Connection issue

### Step 5: Test Connection

After redeploy, test:
```
GET https://alonecloneweb-application.vercel.app/ready
```

**Should return:**
```json
{"status":"ok","db":"connected"}
```

**If still "not_connected":**
- Check Vercel Logs for specific error
- Verify MONGODB_URI is set correctly
- Check MongoDB Atlas Network Access

## 🔍 Common Issues

### Issue 1: Environment Variable Not Set
**Symptom**: Logs show "MONGODB_URI environment variable is not set!"
**Fix**: Add MONGODB_URI in Vercel Settings → Environment Variables

### Issue 2: Wrong Environment
**Symptom**: Variable exists but only for Preview/Development
**Fix**: Make sure it's enabled for **Production** environment

### Issue 3: Wrong Format
**Symptom**: Connection fails with authentication error
**Fix**: Check password is URL-encoded (`%40` not `@`)

### Issue 4: Network Access
**Symptom**: Connection times out
**Fix**: Check MongoDB Atlas → Network Access → Add `0.0.0.0/0`

### Issue 5: Not Redeployed
**Symptom**: Variable added but still not working
**Fix**: **MUST redeploy** after adding environment variables

## ✅ Checklist

- [ ] MONGODB_URI added in Vercel Environment Variables
- [ ] Value is correct (starts with `mongodb+srv://`)
- [ ] Enabled for Production environment
- [ ] Backend redeployed after adding variable
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0`
- [ ] `/ready` endpoint returns `"db":"connected"`
- [ ] Login works without timeout errors

## 🆘 Still Not Working?

1. **Check Vercel Function Logs**
   - Look for specific error messages
   - Check if MONGODB_URI is being read

2. **Test Connection String Locally**
   - Try connecting with MongoDB Compass
   - Verify credentials are correct

3. **Verify MongoDB Atlas**
   - Cluster is running (not paused)
   - Network Access configured
   - Database user exists and password is correct


