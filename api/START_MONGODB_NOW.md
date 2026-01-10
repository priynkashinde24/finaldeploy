# Start MongoDB Now - Quick Guide

## ✅ MongoDB Found!
- **Location:** `C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe`
- **Service:** MongoDB (currently stopped)

---

## 🚀 Quick Start Options

### Option 1: Start MongoDB Service (Requires Admin) ⭐ RECOMMENDED

1. **Open PowerShell as Administrator:**
   - Press `Win + X`
   - Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Start MongoDB:**
   ```powershell
   Start-Service -Name "MongoDB"
   ```

3. **Verify it's running:**
   ```powershell
   Get-Service MongoDB
   ```
   Should show: `Status : Running`

### Option 2: Start MongoDB Manually (No Admin Needed)

1. **Create data directory** (if needed):
   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\data\db"
   ```

2. **Start MongoDB** (use full path):
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

   **Keep this terminal open** - MongoDB runs in it.

### Option 3: Use Services GUI

1. Press `Win + R`
2. Type: `services.msc`
3. Find **"MongoDB Server (MongoDB)"**
4. Right-click → **"Start"**

---

## ✅ After MongoDB Starts

### Connect in MongoDB Compass:
```
mongodb://localhost:27017/revocart
```

### Update Backend .env:
```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

### Verify MongoDB is Running:
```powershell
Test-NetConnection localhost -Port 27017
```
Should show: `TcpTestSucceeded : True`

---

## 📝 Quick Commands

### Check if MongoDB is running:
```powershell
Test-NetConnection localhost -Port 27017
```

### Check service status:
```powershell
Get-Service MongoDB
```

### Start service (as Admin):
```powershell
Start-Service -Name "MongoDB"
```

### Start manually:
```powershell
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```

---

## 🎯 Next Steps

1. ✅ Start MongoDB (choose one method above)
2. ✅ Test in MongoDB Compass: `mongodb://localhost:27017/revocart`
3. ✅ Update `api/.env`: `MONGODB_URI=mongodb://localhost:27017/revocart`
4. ✅ Start backend: `cd api && npm run dev`

---

## 💡 Pro Tips

- **Service method** is best (starts automatically on boot)
- **Manual method** is good for testing (no admin needed)
- **Default port:** 27017
- **Data directory:** `C:\data\db` (created automatically)

