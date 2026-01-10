# Start MongoDB to Connect in Compass

## ❌ Error: "Failed to connect to localhost:27017"

**MongoDB is not running!** You need to start it first.

---

## 🚀 Quick Start - Choose One Method

### Method 1: Start MongoDB Service (As Administrator) ⭐ BEST

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

### Method 2: Start MongoDB Manually (No Admin Needed)

1. **Open a new PowerShell/terminal window**

2. **Start MongoDB:**
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

3. **Keep this terminal open** - MongoDB runs in it

4. **You should see:**
   ```
   [initandlisten] waiting for connections on port 27017
   ```

### Method 3: Use Services GUI

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

**Expected:** `TcpTestSucceeded : True`

### 2. Connect in MongoDB Compass:

**Connection string:**
```
mongodb://localhost:27017/revocart
```

**Or:**
```
mongodb://127.0.0.1:27017/revocart
```

**Steps:**
1. Open MongoDB Compass
2. Paste the connection string above
3. Click **"Connect"**

**⚠️ Note:** Local MongoDB doesn't require username/password by default.

---

## 🔍 Troubleshooting

### Still can't connect after starting?

1. **Verify MongoDB is actually running:**
   ```powershell
   Test-NetConnection localhost -Port 27017
   ```

2. **Check MongoDB service:**
   ```powershell
   Get-Service MongoDB
   ```

3. **Check if MongoDB process is running:**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*mongo*"}
   ```

4. **Check MongoDB logs:**
   - Usually in: `C:\Program Files\MongoDB\Server\8.0\log\mongod.log`
   - Look for error messages

### Error: "Port 27017 already in use"

**Check what's using the port:**
```powershell
netstat -ano | findstr :27017
```

**Kill the process if needed:**
```powershell
taskkill /PID [PID] /F
```

### Error: "Cannot start MongoDB service"

**Try starting manually:**
```powershell
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```

---

## 📝 Quick Checklist

- [ ] MongoDB service started (or running manually)
- [ ] Port 27017 is listening (`Test-NetConnection localhost -Port 27017`)
- [ ] Using correct connection string: `mongodb://localhost:27017/revocart`
- [ ] MongoDB Compass can connect successfully

---

## 🎯 Step-by-Step

1. **Start MongoDB** (use one of the methods above)
2. **Verify it's running:** `Test-NetConnection localhost -Port 27017`
3. **Open MongoDB Compass**
4. **Paste connection string:** `mongodb://localhost:27017/revocart`
5. **Click "Connect"**

---

## 💡 Important Notes

- **MongoDB must be running** before you can connect
- **Service method** is best (auto-starts on boot)
- **Manual method** is good for testing (keep terminal open)
- **Default port:** 27017
- **No authentication** by default for local MongoDB

---

## 🆘 Still Having Issues?

1. **Check MongoDB is installed:**
   ```powershell
   Test-Path "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
   ```

2. **Check data directory exists:**
   ```powershell
   Test-Path "C:\data\db"
   ```

3. **Try starting with verbose output:**
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db" --verbose
   ```

4. **Check Windows Firewall** - might be blocking port 27017

