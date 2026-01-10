# Vercel MongoDB Setup Guide

## How to Add MongoDB URL to Vercel

### Step 1: Get Your MongoDB Connection String

1. **MongoDB Atlas (Recommended for Production)**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com/)
   - Select your cluster
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/database`

2. **Local MongoDB (Development Only)**
   - Format: `mongodb://localhost:27017/database`

### Step 2: Add to Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter:
   - **Name**: `MONGODB_URI`
   - **Value**: Your MongoDB connection string
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### Step 3: Important Notes

#### Password Encoding
If your password contains special characters, URL-encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

**Example:**
```
Original password: MyP@ss#123
Encoded: MyP%40ss%23123
Connection string: mongodb+srv://user:MyP%40ss%23123@cluster.mongodb.net/database
```

#### MongoDB Atlas Network Access
1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. For Vercel, add: `0.0.0.0/0` (allows all IPs - recommended for serverless)
   - Or add specific Vercel IP ranges if you prefer

#### Database User Permissions
1. Go to MongoDB Atlas → **Database Access**
2. Ensure your user has:
   - Read and write permissions
   - Access to the correct database

### Step 4: Redeploy

After adding the environment variable:
1. Go to **Deployments** tab
2. Click the three dots (⋯) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

### Step 5: Verify Connection

After deployment, check the function logs:
1. Go to **Deployments** → Select your deployment
2. Click **Functions** tab
3. Check logs for: `✅ MongoDB connected successfully`

### Example Connection Strings

**MongoDB Atlas:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority
```

**Local Development:**
```
mongodb://localhost:27017/revocart
```

### Troubleshooting

#### Error: "MONGODB_URI environment variable is not set"
- ✅ Check that `MONGODB_URI` is added in Vercel Environment Variables
- ✅ Ensure it's set for the correct environment (Production/Preview/Development)
- ✅ Redeploy after adding the variable

#### Error: "Authentication failed"
- ✅ Verify username and password are correct
- ✅ URL-encode special characters in password
- ✅ Check database user has proper permissions

#### Error: "Connection timeout" or "ENOTFOUND"
- ✅ Add `0.0.0.0/0` to MongoDB Atlas Network Access
- ✅ Verify cluster is running (not paused)
- ✅ Check connection string format is correct

#### Error: "Invalid connection string"
- ✅ Ensure connection string starts with `mongodb://` or `mongodb+srv://`
- ✅ Check for extra spaces or line breaks
- ✅ Verify database name is included after the host

### Quick Checklist

- [ ] MongoDB Atlas cluster created and running
- [ ] Database user created with read/write permissions
- [ ] Network Access configured (0.0.0.0/0 for Vercel)
- [ ] Connection string copied from MongoDB Atlas
- [ ] Password URL-encoded if it contains special characters
- [ ] `MONGODB_URI` added to Vercel Environment Variables
- [ ] Environment variable set for all environments
- [ ] Project redeployed after adding variable
- [ ] Connection verified in deployment logs

