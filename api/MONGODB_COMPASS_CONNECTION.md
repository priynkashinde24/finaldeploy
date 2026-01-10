# MongoDB Compass Connection Guide

## ❌ Common Mistakes

You're trying to connect with just the hostname:
- ❌ `cluster.mongodb.net`
- ❌ `cluster0.tmaqm0h.mongodb.net`
- ❌ `localhost:27017`

**MongoDB Compass needs the FULL connection string with credentials!**

---

## ✅ Correct Connection String Format

### For MongoDB Atlas (Cloud)

**Full connection string format:**
```
mongodb+srv://USERNAME:PASSWORD@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

**Example:**
```
mongodb+srv://admin:MyPassword123@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

### For Local MongoDB

**Full connection string format:**
```
mongodb://localhost:27017/revocart
```

---

## 📝 How to Connect in MongoDB Compass

### Step 1: Get Your Connection String

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com/
2. **Sign in** to your account
3. **Select your cluster** (cluster0.tmaqm0h)
4. **Click "Connect"** button
5. **Choose "Connect using MongoDB Compass"**
6. **Copy the connection string**

It will look like:
```
mongodb+srv://<username>:<password>@cluster0.tmaqm0h.mongodb.net/?retryWrites=true&w=majority
```

### Step 2: Replace Placeholders

1. **Replace `<username>`** with your MongoDB Atlas username
2. **Replace `<password>`** with your MongoDB Atlas password
3. **Add database name** before the `?`:
   - Change: `...mongodb.net/?retryWrites...`
   - To: `...mongodb.net/revocart?retryWrites...`

**Final connection string:**
```
mongodb+srv://yourusername:yourpassword@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

### Step 3: URL-Encode Special Characters

If your password has special characters, URL-encode them:

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
| `/` | `%2F` |
| `:` | `%3A` |

**Example:**
- Password: `MyP@ss#123`
- Encoded: `MyP%40ss%23123`
- Connection string: `mongodb+srv://user:MyP%40ss%23123@cluster0.tmaqm0h.mongodb.net/revocart`

### Step 4: Connect in MongoDB Compass

1. **Open MongoDB Compass**
2. **Paste the full connection string** in the connection field
3. **Click "Connect"**

**DO NOT:**
- ❌ Use just the hostname
- ❌ Use just `cluster0.tmaqm0h.mongodb.net`
- ❌ Forget username and password

**DO:**
- ✅ Use the complete connection string
- ✅ Include `mongodb+srv://` prefix
- ✅ Include username and password
- ✅ Include database name

---

## 🔧 Troubleshooting

### Error: "Failed to connect to cluster0.tmaqm0h.mongodb.net"

**Causes:**
1. Missing username/password in connection string
2. Wrong credentials
3. IP not whitelisted
4. Cluster paused

**Solutions:**

1. **Check Connection String Format**
   - Must start with `mongodb+srv://`
   - Must include `username:password@`
   - Must include database name

2. **Verify MongoDB Atlas Settings:**
   - **Network Access**: Add IP `0.0.0.0/0` (or your IP)
   - **Database Access**: Verify user exists with correct password
   - **Cluster Status**: Make sure cluster is running (not paused)

3. **Test Connection:**
   - Try the connection string in MongoDB Compass
   - If it works in Compass, use the same string in your `.env` file

### Error: "Authentication failed"

- Verify username and password in MongoDB Atlas
- URL-encode special characters in password
- Check user has proper permissions

### Error: "Connection refused" or "ENOTFOUND"

- Check Network Access → IP whitelist
- Verify cluster is running
- Check connection string hostname is correct

---

## 📋 Quick Checklist

Before connecting:

- [ ] Have MongoDB Atlas account
- [ ] Cluster is created and running
- [ ] Database user created with username/password
- [ ] Network Access → IP whitelisted (0.0.0.0/0 for testing)
- [ ] Connection string copied from MongoDB Atlas
- [ ] Username and password replaced in connection string
- [ ] Database name added to connection string
- [ ] Special characters in password URL-encoded

---

## 💡 Example Connection Strings

### MongoDB Atlas (Your Cluster)
```
mongodb+srv://admin:password123@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

### MongoDB Atlas (With Special Characters in Password)
If password is `MyP@ss#123`:
```
mongodb+srv://admin:MyP%40ss%23123@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

### Local MongoDB
```
mongodb://localhost:27017/revocart
```

---

## 🎯 Next Steps

1. **Get connection string from MongoDB Atlas** (Connect → MongoDB Compass)
2. **Replace username and password** with your actual credentials
3. **Add database name** (`/revocart`) before the `?`
4. **Test in MongoDB Compass** first
5. **Once working in Compass, use the same string in `api/.env`**

---

## 🆘 Still Can't Connect?

1. **Verify in MongoDB Atlas:**
   - Cluster is running (not paused)
   - Network Access has your IP (or 0.0.0.0/0)
   - Database user exists with correct password

2. **Check connection string:**
   - Copy directly from MongoDB Atlas
   - Don't modify except replacing `<username>` and `<password>`
   - Add database name before `?`

3. **Test with MongoDB Compass:**
   - If Compass works, backend will work with same string
   - If Compass fails, fix Atlas settings first

