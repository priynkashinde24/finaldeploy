# MongoDB Connection Setup Guide

## ❌ Current Issue
Your `.env` file has a **placeholder** connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/revocart
```

This needs to be replaced with your **actual** MongoDB Atlas connection string.

---

## ✅ Step-by-Step Fix

### Step 1: Get Your MongoDB Atlas Connection String

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com/
2. **Sign in** to your account
3. **Select your cluster** (or create one if you don't have one)
4. **Click "Connect"** button
5. **Choose "Connect your application"**
6. **Select "Node.js"** and copy the connection string

It will look like:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### Step 2: Update Your Connection String

1. **Replace `<username>`** with your MongoDB Atlas database username
2. **Replace `<password>`** with your MongoDB Atlas database password
3. **Add database name** before the `?`:
   - Change: `...mongodb.net/?retryWrites...`
   - To: `...mongodb.net/revocart?retryWrites...`

**Final format should be:**
```
mongodb+srv://myusername:mypassword@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority
```

### Step 3: URL-Encode Special Characters in Password

If your password contains special characters, you MUST URL-encode them:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `?` | `%3F` |

**Example:**
- Password: `MyP@ss#123`
- Encoded: `MyP%40ss%23123`
- Connection string: `mongodb+srv://user:MyP%40ss%23123@cluster0.xxxxx.mongodb.net/revocart`

### Step 4: Update Your .env File

1. Open `api/.env` file
2. Find the line: `MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/revocart`
3. Replace it with your actual connection string
4. **Make sure:**
   - No spaces around the `=`
   - Everything on one line (no line breaks)
   - No quotes around the value

**Correct format:**
```env
MONGODB_URI=mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority
```

### Step 5: Verify MongoDB Atlas Settings

Before connecting, make sure:

1. **Network Access (IP Whitelist)**
   - Go to MongoDB Atlas → **Network Access**
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0) for testing
   - Click **"Confirm"**

2. **Database User**
   - Go to MongoDB Atlas → **Database Access**
   - Verify your user exists
   - If needed, create a new user:
     - Click **"Add New Database User"**
     - Choose **"Password"** authentication
     - Set username and password
     - Grant **"Atlas Admin"** role (for testing)
     - Click **"Add User"**

3. **Cluster Status**
   - Make sure your cluster is **"Running"** (not paused)
   - If paused, click **"Resume"**

### Step 6: Restart Backend

After updating `.env`:

```bash
cd api
npm run dev
```

You should see:
```
🔄 Connecting to MongoDB...
   URI: mongodb+srv://username:****@cluster0.xxxxx.mongodb.net/revocart
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
   Database: revocart
Server is running on port 5000
```

---

## 🔍 Troubleshooting

### Error: "Invalid connection string"
- Check that connection string starts with `mongodb+srv://`
- Verify no spaces or line breaks
- Ensure username and password are correct

### Error: "Authentication failed"
- Verify username and password in MongoDB Atlas
- URL-encode special characters in password
- Check user has proper permissions

### Error: "Connection refused" or "ENOTFOUND"
- Check Network Access → IP whitelist (add 0.0.0.0/0)
- Verify cluster is running (not paused)
- Check connection string hostname is correct

### Error: "ECONNREFUSED localhost:27017"
- This means MONGODB_URI is not set or invalid
- Check `.env` file exists and has correct format
- Restart backend after updating `.env`

---

## 📝 Example .env File

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://admin:MyP%40ssw0rd@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Configuration
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_app_password_here

# SMS Configuration
FAST2SMS_API_KEY=your_fast2sms_api_key

# Server Port
PORT=5000
NODE_ENV=development
```

---

## 🆘 Still Having Issues?

1. **Check terminal output** - The improved error messages will show specific issues
2. **Verify connection string** - Copy directly from MongoDB Atlas
3. **Test connection** - Try connecting via MongoDB Compass with the same credentials
4. **Check MongoDB Atlas status** - Ensure cluster is running and accessible

