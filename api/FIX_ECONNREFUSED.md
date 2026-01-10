# Fix ECONNREFUSED Error - MongoDB Not Running

## ❌ Error: `ECONNREFUSED 127.0.0.1:27017`

This means **MongoDB is not running**. You need to start it first.

---

## 🚀 Quick Fix - Start MongoDB

### Option 1: Start MongoDB Service (As Administrator) ⭐ BEST

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

4. **Test connection:**
   ```powershell
   Test-NetConnection localhost -Port 27017
   ```
   Should show: `TcpTestSucceeded : True`

### Option 2: Start MongoDB Manually (No Admin Needed)

1. **Open a new terminal/PowerShell window**

2. **Start MongoDB:**
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

3. **Keep this terminal open** - MongoDB runs in it

4. **You should see:**
   ```
   [initandlisten] waiting for connections on port 27017
   ```

### Option 3: Use Services GUI

1. Press `Win + R`
2. Type: `services.msc` and press Enter
3. Find **"MongoDB Server (MongoDB)"**
4. Right-click → **"Start"**
5. Status should change to "Running"

---

## ✅ After Starting MongoDB

### 1. Verify MongoDB is Running:

```powershell
Test-NetConnection localhost -Port 27017
```

**Expected output:**
```
TcpTestSucceeded : True
```

### 2. Connect in MongoDB Compass:

```
mongodb://localhost:27017/revocart
```

### 3. Update Backend .env:

```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

### 4. Restart Backend:

```bash
cd api
npm run dev
```

**Expected output:**
```
✅ MongoDB Connected: localhost
   Database: revocart
Server is running on port 5000
```

---

## 🔍 Troubleshooting

### Error: "Cannot start MongoDB service"

**Solution:**
- Run PowerShell as Administrator
- Or start MongoDB manually (Option 2)

### Error: "Port 27017 already in use"

**Check what's using the port:**
```powershell
netstat -ano | findstr :27017
```

**Kill the process if needed:**
```powershell
taskkill /PID [PID] /F
```

### Error: "Data directory not found"

**Create it:**
```powershell
New-Item -ItemType Directory -Force -Path "C:\data\db"
```

### MongoDB starts but immediately stops

**Check MongoDB logs:**
- Usually in: `C:\Program Files\MongoDB\Server\8.0\log\mongod.log`
- Look for error messages

**Common issues:**
- Data directory permissions
- Port already in use
- Configuration file errors

---

## 📝 Quick Checklist

- [ ] MongoDB service started (or running manually)
- [ ] Port 27017 is listening (`Test-NetConnection localhost -Port 27017`)
- [ ] Can connect in MongoDB Compass: `mongodb://localhost:27017/revocart`
- [ ] Updated `api/.env`: `MONGODB_URI=mongodb://localhost:27017/revocart`
- [ ] Restarted backend after updating `.env`
- [ ] Backend shows: `✅ MongoDB Connected`

---

## 🎯 Step-by-Step Fix

1. **Start MongoDB** (use one of the options above)
2. **Verify it's running:** `Test-NetConnection localhost -Port 27017`
3. **Test in Compass:** `mongodb://localhost:27017/revocart`
4. **Update .env:** `MONGODB_URI=mongodb://localhost:27017/revocart`
5. **Restart backend:** `cd api && npm run dev`
6. **Check logs:** Should see `✅ MongoDB Connected`

---

## 💡 Pro Tips

- **Service method** is best (auto-starts on boot)
- **Manual method** is good for testing
- **Keep terminal open** if starting manually
- **Check port 27017** to verify MongoDB is running
- **Restart backend** after changing `.env`

---

## 🆘 Still Getting ECONNREFUSED?

1. **Verify MongoDB is actually running:**
   ```powershell
   Test-NetConnection localhost -Port 27017
   ```

2. **Check MongoDB service:**
   ```powershell
   Get-Service MongoDB
   ```

3. **Check MongoDB process:**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*mongo*"}
   ```

4. **Try starting manually:**
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

5. **Check MongoDB logs** for errors

