# Local MongoDB Setup Guide

## ❌ Current Issue
You're trying to connect to `localhost:27017`, but MongoDB is not running locally.

---

## Option 1: Use MongoDB Atlas (Cloud) - RECOMMENDED ✅

**No installation needed!** Just use the full connection string.

### Steps:
1. Go to https://cloud.mongodb.com/
2. Sign in (or create free account)
3. Get your connection string
4. Use it in MongoDB Compass and backend

**Connection string format:**
```
mongodb+srv://username:password@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

**⚠️ DO NOT use just `localhost:27017` - use the FULL connection string!**

---

## Option 2: Install and Run Local MongoDB

### Step 1: Install MongoDB

**Windows:**
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Run the installer
3. Choose "Complete" installation
4. Install as a Windows Service (recommended)

**Or use MongoDB via Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo
```

### Step 2: Start MongoDB Service

**Windows Service (if installed as service):**
- MongoDB should start automatically
- Check Services: `services.msc` → Look for "MongoDB"

**Manual Start:**
```bash
mongod --dbpath "C:\data\db"
```

### Step 3: Verify MongoDB is Running

```bash
# Check if MongoDB is listening on port 27017
netstat -an | findstr 27017
```

### Step 4: Connect in MongoDB Compass

**Connection string:**
```
mongodb://localhost:27017/revocart
```

**Or:**
```
mongodb://127.0.0.1:27017/revocart
```

### Step 5: Update Backend .env

```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

---

## 🎯 Quick Decision Guide

### Use MongoDB Atlas if:
- ✅ You want to start quickly (no installation)
- ✅ You need cloud access
- ✅ You're working with a team
- ✅ You want automatic backups

### Use Local MongoDB if:
- ✅ You want offline development
- ✅ You prefer local data storage
- ✅ You have MongoDB installed
- ✅ You want full control

---

## ⚠️ Important Notes

### For MongoDB Atlas:
- **MUST use full connection string** (not just hostname)
- **MUST configure Network Access** (0.0.0.0/0)
- **MUST use username:password** in connection string

### For Local MongoDB:
- **MUST have MongoDB installed**
- **MUST have MongoDB running** (service or manual)
- **MUST create data directory** (`C:\data\db`)

---

## 🚀 Recommended: Use MongoDB Atlas

Since you're having trouble with localhost, I recommend using MongoDB Atlas:

1. **No installation needed**
2. **Works immediately** with connection string
3. **Free tier available**
4. **Same connection string works in Compass and backend**

**Just get the connection string from MongoDB Atlas and use it!**

---

## 📝 Next Steps

### If Using MongoDB Atlas:
1. Get connection string from https://cloud.mongodb.com/
2. Use FULL string in MongoDB Compass
3. Use SAME string in `api/.env`
4. Configure Network Access (0.0.0.0/0)

### If Using Local MongoDB:
1. Install MongoDB Community Server
2. Start MongoDB service
3. Use `mongodb://localhost:27017/revocart` in Compass
4. Use same in `api/.env`

---

## 🆘 Still Having Issues?

**For MongoDB Atlas:**
- Use FULL connection string (with username:password)
- Check Network Access settings
- Verify cluster is running

**For Local MongoDB:**
- Check MongoDB service is running
- Verify port 27017 is not blocked
- Check data directory exists

