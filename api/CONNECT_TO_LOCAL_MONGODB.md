# Connect to Local MongoDB

## ✅ MongoDB is Installed Locally

Great! Now let's connect to it properly.

---

## Step 1: Start MongoDB Service

### Check if MongoDB is Running:

**Windows Service:**
```powershell
Get-Service MongoDB
```

**Or check port:**
```powershell
Test-NetConnection localhost -Port 27017
```

### Start MongoDB if Not Running:

**Option A: Windows Service**
```powershell
Start-Service MongoDB
```

**Option B: Manual Start**
```bash
mongod --dbpath "C:\data\db"
```

**Note:** Make sure `C:\data\db` directory exists, or use your MongoDB data directory.

---

## Step 2: Connect in MongoDB Compass

### Use This Connection String:

```
mongodb://localhost:27017/revocart
```

**Or:**
```
mongodb://127.0.0.1:27017/revocart
```

### In MongoDB Compass:
1. Open MongoDB Compass
2. Paste: `mongodb://localhost:27017/revocart`
3. Click **"Connect"**

**⚠️ Note:** Local MongoDB doesn't require username/password by default.

---

## Step 3: Update Backend .env File

Open `api/.env` and set:

```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

**Or if you have authentication enabled:**
```env
MONGODB_URI=mongodb://username:password@localhost:27017/revocart
```

---

## Step 4: Create Database (Optional)

MongoDB will create the database automatically when you first use it, but you can create it manually:

1. In MongoDB Compass, after connecting
2. Click **"CREATE DATABASE"**
3. Database Name: `revocart`
4. Collection Name: `users` (or any name)
5. Click **"Create Database"**

---

## 🔧 Troubleshooting

### Error: "Failed to connect to localhost:27017"

**Causes:**
1. MongoDB service not running
2. MongoDB not installed correctly
3. Port 27017 blocked by firewall
4. MongoDB data directory doesn't exist

**Solutions:**

1. **Start MongoDB Service:**
   ```powershell
   Start-Service MongoDB
   ```

2. **Check if MongoDB is running:**
   ```powershell
   Get-Service MongoDB
   ```

3. **Check port:**
   ```powershell
   Test-NetConnection localhost -Port 27017
   ```

4. **Start MongoDB manually:**
   ```bash
   mongod --dbpath "C:\data\db"
   ```
   (Make sure `C:\data\db` exists or create it)

5. **Check MongoDB logs:**
   - Usually in: `C:\Program Files\MongoDB\Server\[version]\log\mongod.log`

### Error: "Cannot connect to MongoDB"

1. **Verify MongoDB is installed:**
   ```powershell
   Get-Command mongod
   ```

2. **Check MongoDB version:**
   ```bash
   mongod --version
   ```

3. **Verify data directory exists:**
   - Default: `C:\data\db`
   - Create it if it doesn't exist

---

## 📝 Quick Start Commands

### Start MongoDB (Windows Service):
```powershell
Start-Service MongoDB
```

### Start MongoDB (Manual):
```bash
mongod --dbpath "C:\data\db"
```

### Check MongoDB Status:
```powershell
Get-Service MongoDB
```

### Test Connection:
```powershell
Test-NetConnection localhost -Port 27017
```

---

## ✅ Connection String Formats

### Local MongoDB (No Auth):
```
mongodb://localhost:27017/revocart
```

### Local MongoDB (With Auth):
```
mongodb://username:password@localhost:27017/revocart
```

### Local MongoDB (Custom Port):
```
mongodb://localhost:27018/revocart
```

---

## 🎯 Next Steps

1. ✅ Start MongoDB service
2. ✅ Connect in MongoDB Compass using `mongodb://localhost:27017/revocart`
3. ✅ Update `api/.env` with `MONGODB_URI=mongodb://localhost:27017/revocart`
4. ✅ Start backend: `cd api && npm run dev`
5. ✅ Verify connection in backend logs

---

## 💡 Pro Tips

- **Default port:** 27017
- **Default data directory:** `C:\data\db`
- **No authentication by default** (unless you configured it)
- **Database created automatically** on first use
- **Service name:** Usually "MongoDB" in Windows Services

---

## 🆘 Still Having Issues?

1. **Check MongoDB is actually running:**
   - Windows Services → Look for "MongoDB"
   - Or check port 27017 is listening

2. **Verify installation:**
   - MongoDB should be in `C:\Program Files\MongoDB\`
   - Check if `mongod.exe` exists

3. **Check firewall:**
   - Windows Firewall might block port 27017
   - Allow MongoDB through firewall if needed

4. **Check logs:**
   - MongoDB logs will show connection errors
   - Usually in MongoDB installation directory

