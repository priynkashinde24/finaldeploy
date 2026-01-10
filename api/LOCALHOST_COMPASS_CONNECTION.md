# Connect to Localhost MongoDB in Compass

## 🎯 Quick Connection Guide

### Step 1: Start MongoDB

**Option A: Start Service (As Administrator)**
```powershell
Start-Service -Name "MongoDB"
```

**Option B: Start Manually (No Admin)**
```powershell
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```
*Keep this terminal open - MongoDB runs in it*

### Step 2: Verify MongoDB is Running

```powershell
Test-NetConnection localhost -Port 27017
```
Should show: `TcpTestSucceeded : True`

### Step 3: Connect in MongoDB Compass

**Connection String:**
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

---

## ✅ Complete Setup

### 1. Start MongoDB

**As Administrator:**
```powershell
Start-Service -Name "MongoDB"
```

**Or Manually:**
```powershell
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```

### 2. Verify Running

```powershell
Test-NetConnection localhost -Port 27017
```

### 3. Connect in Compass

**Connection String:**
```
mongodb://localhost:27017/revocart
```

### 4. Update Backend .env

```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

### 5. Start Backend

```bash
cd api
npm run dev
```

---

## 📝 Connection Strings

### For MongoDB Compass:
```
mongodb://localhost:27017/revocart
```

### For Backend .env:
```env
MONGODB_URI=mongodb://localhost:27017/revocart
```

**Note:** Local MongoDB doesn't require username/password by default.

---

## 🔍 Troubleshooting

### Can't connect to localhost:27017?

1. **Check MongoDB is running:**
   ```powershell
   Test-NetConnection localhost -Port 27017
   ```

2. **Start MongoDB:**
   ```powershell
   Start-Service -Name "MongoDB"
   ```
   Or manually:
   ```powershell
   & "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
   ```

3. **Check service status:**
   ```powershell
   Get-Service MongoDB
   ```

---

## ✅ Quick Checklist

- [ ] MongoDB service started (or running manually)
- [ ] Port 27017 is listening
- [ ] Using connection string: `mongodb://localhost:27017/revocart`
- [ ] Can connect in MongoDB Compass
- [ ] Updated `api/.env` with same connection string
- [ ] Backend can connect

---

## 💡 Important Notes

- **MongoDB must be running** before connecting
- **No authentication** needed for local MongoDB (by default)
- **Default port:** 27017
- **Database name:** `revocart` (will be created automatically)
- **Keep terminal open** if starting manually

---

## 🎯 One-Line Commands

### Start MongoDB Service:
```powershell
Start-Service -Name "MongoDB"
```

### Start MongoDB Manually:
```powershell
& "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --dbpath "C:\data\db"
```

### Test Connection:
```powershell
Test-NetConnection localhost -Port 27017
```

### Connection String for Compass:
```
mongodb://localhost:27017/revocart
```

