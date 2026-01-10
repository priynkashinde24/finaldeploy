# How to Create Database in MongoDB Compass

## ⚠️ First: You MUST Connect Successfully

Before creating a database, you need to connect to MongoDB using the **FULL connection string**.

---

## Step 1: Connect to MongoDB Compass

### Use FULL Connection String (NOT just hostname):

```
mongodb+srv://USERNAME:PASSWORD@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

**Replace:**
- `USERNAME` → Your MongoDB Atlas username
- `PASSWORD` → Your MongoDB Atlas password

**Example:**
```
mongodb+srv://admin:password123@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
```

### In MongoDB Compass:
1. Open MongoDB Compass
2. **Paste the complete connection string** (with username:password)
3. Click **"Connect"**

**⚠️ If connection fails:**
- Check MongoDB Atlas → Network Access → Add IP (0.0.0.0/0)
- Verify username and password are correct
- Make sure cluster is running (not paused)

---

## Step 2: Create New Database

Once connected:

### Method 1: Create Database from Collections View

1. In MongoDB Compass, you'll see your databases on the left
2. Click **"CREATE DATABASE"** button (top right)
3. Fill in:
   - **Database Name:** `revocart` (or your choice)
   - **Collection Name:** `users` (or any collection name)
4. Click **"Create Database"**

### Method 2: Create Database via Command

1. Click on your cluster connection
2. You'll see a list of databases
3. Click **"CREATE DATABASE"** button
4. Enter:
   - **Database Name:** `revocart`
   - **Collection Name:** `users` (required - can be empty)
5. Click **"Create Database"**

---

## Step 3: Verify Database Created

After creating:
1. You should see `revocart` in the database list
2. Click on it to see collections
3. The database is ready to use!

---

## 📝 For Your Backend Project

Your backend expects a database named `revocart`. 

**Connection string should include database name:**
```
mongodb+srv://username:password@cluster0.tmaqm0h.mongodb.net/revocart?retryWrites=true&w=majority
                                                                    ↑
                                                          Database name here
```

**If database doesn't exist:**
- MongoDB will create it automatically when you first write data
- OR create it manually in Compass as shown above

---

## ✅ Quick Checklist

Before creating database:
- [ ] Successfully connected to MongoDB in Compass
- [ ] Can see existing databases (or empty list)
- [ ] Network Access configured in MongoDB Atlas
- [ ] Using full connection string (not just hostname)

To create database:
- [ ] Click "CREATE DATABASE" button
- [ ] Enter database name: `revocart`
- [ ] Enter collection name: `users` (or any name)
- [ ] Click "Create Database"
- [ ] Verify database appears in list

---

## 🆘 Troubleshooting

### Can't see "CREATE DATABASE" button?
- Make sure you're connected successfully
- Check you're viewing the databases list
- Try refreshing the connection

### Database not showing up?
- Refresh the connection
- Check if you're looking at the right cluster
- Verify database name spelling

### Still can't connect?
- Use FULL connection string (with username:password)
- Check Network Access in MongoDB Atlas
- Verify cluster is running (not paused)

---

## 💡 Pro Tip

**MongoDB creates databases automatically** when you first insert data. So if your backend connects and starts creating collections, the database will be created automatically!

You don't necessarily need to create it manually in Compass - just make sure your connection string includes the database name (`/revocart`).

