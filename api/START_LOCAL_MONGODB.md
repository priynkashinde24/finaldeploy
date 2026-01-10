# Start Local MongoDB

## ⚠️ MongoDB Service is Stopped

MongoDB is installed but not running. Here's how to start it:

---

## Method 1: Start MongoDB Service (Recommended)

### As Administrator:

1. **Open PowerShell as Administrator:**
   - Right-click PowerShell → "Run as Administrator"

2. **Start MongoDB Service:**
   ```powershell
   Start-Service MongoDB
   ```

3. **Verify it's running:**
   ```powershell
   Get-Service MongoDB
   ```

### Or Use Services GUI:

1. Press `Win + R`
2. Type: `services.msc`
3. Find **"MongoDB"** or **"MongoDB Server"**
4. Right-click → **"Start"**

---

## Method 2: Start MongoDB Manually

### Step 1: Create Data Directory

```powershell
# Create MongoDB data directory
New-Item -ItemType Directory -Force -Path "C:\data\db"
```

### Step 2: Start MongoDB Manually

Open a new terminal and run:

```bash
mongod --dbpath "C:\data\db"
```

**Keep this terminal open** - MongoDB will run in it.

---

## Method 3: Check MongoDB Installation

### Verify MongoDB is installed:

```powershell
Get-Command mongod
```

### Check MongoDB version:

```bash
mongod --version
```

### Find MongoDB installation:

Usually in: `C:\Program Files\MongoDB\Server\[version]\bin\`

---

## Step 2: Connect in MongoDB Compass

Once MongoDB is running, use this connection string:

```
mongodb://localhost:27017/revocart
```

### In MongoDB Compass:
1. Open MongoDB Compass
2. Paste: `mongodb://localhost:27017/revocart`
3. Click **"Connect"**

---

## Step 3: Update Backend .env

Open `api/.env` and set:

```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

---

## Step 4: Verify MongoDB is Running

### Check port 27017:

```powershell
Test-NetConnection localhost -Port 27017
```

**Expected:** `TcpTestSucceeded : True`

### Or check service status:

```powershell
Get-Service MongoDB
```

**Expected:** `Status : Running`

---

## 🔧 Troubleshooting

### Error: "Cannot start MongoDB service"

**Possible causes:**
1. **Missing data directory:**
   - Create: `C:\data\db`
   - Or specify custom path: `mongod --dbpath "C:\your\path"`

2. **Port 27017 already in use:**
   - Check: `netstat -an | findstr 27017`
   - Kill process using port if needed

3. **Permission issues:**
   - Run as Administrator
   - Check MongoDB service account permissions

4. **MongoDB configuration issue:**
   - Check MongoDB config file
   - Usually in: `C:\Program Files\MongoDB\Server\[version]\bin\mongod.cfg`

### Error: "Access denied"

- Run PowerShell/Command Prompt as Administrator
- Check MongoDB service account has proper permissions

### Error: "Port 27017 already in use"

```powershell
# Find process using port 27017
netstat -ano | findstr :27017

# Kill the process (replace PID with actual process ID)
taskkill /PID [PID] /F
```

---

## ✅ Quick Start Checklist

- [ ] MongoDB is installed
- [ ] Data directory exists (`C:\data\db`)
- [ ] MongoDB service started (or running manually)
- [ ] Port 27017 is listening
- [ ] Can connect in MongoDB Compass
- [ ] Updated `api/.env` with local connection string

---

## 🎯 Next Steps

1. **Start MongoDB** (using one of the methods above)
2. **Test connection** in MongoDB Compass: `mongodb://localhost:27017/revocart`
3. **Update backend .env**: `MONGODB_URI=mongodb://localhost:27017/revocart`
4. **Start backend**: `cd api && npm run dev`
5. **Verify connection** in backend logs

---

## 💡 Pro Tips

- **Default port:** 27017
- **Default data directory:** `C:\data\db`
- **Service name:** Usually "MongoDB" or "MongoDB Server"
- **No authentication by default** (unless configured)
- **Keep terminal open** if starting manually

---

## 🆘 Still Can't Start?

1. **Check MongoDB logs:**
   - Usually in: `C:\Program Files\MongoDB\Server\[version]\log\mongod.log`
   - Look for error messages

2. **Reinstall MongoDB:**
   - Download from: https://www.mongodb.com/try/download/community
   - Choose "Complete" installation
   - Install as Windows Service

3. **Use MongoDB Atlas instead:**
   - No installation needed
   - Works immediately with connection string
   - Free tier available

