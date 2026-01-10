# MongoDB Migration Guide

This guide will help you migrate your local MongoDB database to MongoDB Atlas.

## Prerequisites

1. **Local MongoDB must be running**
   - Check if MongoDB service is running on Windows:
     ```powershell
     Get-Service MongoDB
     ```
   - If not running, start it:
     ```powershell
     Start-Service MongoDB
     ```
   - Or verify connection:
     ```powershell
     Test-NetConnection localhost -Port 27017
     ```

2. **MongoDB Atlas Access**
   - Your IP address must be whitelisted in MongoDB Atlas
   - Go to MongoDB Atlas → Network Access → Add IP Address
   - For testing, you can temporarily allow `0.0.0.0/0` (all IPs) - **NOT recommended for production**

3. **Internet Connection**
   - You need internet access to connect to MongoDB Atlas

## Running the Migration

1. **Navigate to the api directory:**
   ```powershell
   cd api
   ```

2. **Run the migration script:**
   ```powershell
   node migrate-to-atlas.mjs
   ```

## What the Script Does

1. Connects to your local MongoDB database (`mongodb://localhost:27017/revocart`)
2. Connects to MongoDB Atlas (`mongodb+srv://admin:Priyanka@98@cluster0.mzws36m.mongodb.net/revocart`)
3. Lists all collections in your local database
4. Migrates each collection to Atlas (skips if collection already exists in Atlas)
5. Shows a summary of the migration

## Important Notes

- **The script will skip collections that already exist in Atlas** to avoid duplicates
- If you want to replace existing data, you'll need to manually delete collections in Atlas first
- The script processes documents in batches of 1000 for better performance
- All documents are copied as-is (no data transformation)

## After Migration

1. **Update your environment variables:**
   - Update `MONGODB_URI` in your `.env` file:
     ```
     MONGODB_URI=mongodb+srv://admin:Priyanka@98@cluster0.mzws36m.mongodb.net/revocart
     ```

2. **Update Vercel environment variables (if deployed):**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Update `MONGODB_URI` with the Atlas connection string

3. **Test the connection:**
   - Restart your application
   - Verify that it connects to MongoDB Atlas successfully

## Troubleshooting

### Error: "ECONNREFUSED" or "Failed to connect to localhost:27017"
- **Solution:** Make sure local MongoDB is running
  ```powershell
  Start-Service MongoDB
  ```

### Error: "MongoServerError: IP not whitelisted"
- **Solution:** Add your IP address to MongoDB Atlas Network Access
  1. Go to MongoDB Atlas Dashboard
  2. Click "Network Access" in the left menu
  3. Click "Add IP Address"
  4. Add your current IP or `0.0.0.0/0` for testing

### Error: "Authentication failed"
- **Solution:** Verify your MongoDB Atlas username and password are correct
- Check the connection string format

### Error: "Collection already exists"
- **Solution:** This is normal - the script skips existing collections to avoid duplicates
- If you want to replace data, delete the collection in Atlas first using MongoDB Compass or Atlas UI

## Verification

After migration, verify your data in MongoDB Atlas:

1. **Using MongoDB Compass:**
   - Connect to: `mongodb+srv://admin:Priyanka@98@cluster0.mzws36m.mongodb.net/revocart`
   - Browse your collections and verify document counts

2. **Using MongoDB Atlas UI:**
   - Go to MongoDB Atlas Dashboard
   - Click "Browse Collections"
   - Verify all collections and document counts match your local database

## Security Note

⚠️ **Important:** The connection string contains your password. Make sure to:
- Never commit this to version control
- Use environment variables in production
- Consider changing the password after migration
- Use MongoDB Atlas IP whitelisting for security

