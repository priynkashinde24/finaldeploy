import mongoose from 'mongoose';

// Fail fast instead of buffering queries when Mongo isn't connected.
// This prevents confusing errors like: "Operation `users.findOne()` buffering timed out..."
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 0);

// Always require an explicit connection string (never fall back to hardcoded credentials).
const MONGODB_URI = process.env.MONGODB_URI;

export const connectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    // Validate MONGODB_URI is set
    if (!MONGODB_URI) {
      const error = new Error('MONGODB_URI is not set!');
      console.error('❌ MONGODB_URI is not set!');
      console.error('📝 Please add MONGODB_URI to your environment variables');
      console.error('   Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/revocart');
      // Always throw (never kill the process). Callers decide whether to exit.
      throw error;
    }

    // Sanitize and validate connection string
    let connectionString = MONGODB_URI.trim();
    
    // Check if MONGODB_URI is a placeholder
    // Common Atlas placeholder patterns:
    // - mongodb+srv://username:password@cluster.mongodb.net/<db>
    // - mongodb+srv://USER:PASS@cluster.mongodb.net/<db>  (generic host is invalid: DNS ENOTFOUND)
    const isSrv = connectionString.startsWith('mongodb+srv://');
    const hostMatch = connectionString.match(/mongodb\+srv:\/\/[^@]+@([^\/]+)\//);
    const hostOnly = hostMatch?.[1] || '';
    const looksLikeGenericAtlasHost =
      hostOnly === 'cluster.mongodb.net' ||
      hostOnly === 'cluster0.mongodb.net' ||
      // Real Atlas SRV hosts look like: cluster0.xxxxx.mongodb.net (note the extra segment)
      (isSrv && hostOnly.endsWith('.mongodb.net') && !hostOnly.match(/^[a-z0-9-]+\.[a-z0-9-]+\.mongodb\.net$/i));

    if (connectionString.includes('username:password') || looksLikeGenericAtlasHost) {
      const error = new Error('MONGODB_URI appears to be a placeholder!');
      console.error('❌ MONGODB_URI appears to be a placeholder!');
      console.error('📝 Please replace it with your actual MongoDB Atlas connection string');
      console.error('   Current value:', connectionString.replace(/:[^:@]+@/, ':****@'));
      throw error;
    }

    // Validate connection string format
    if (!connectionString.startsWith('mongodb://') && !connectionString.startsWith('mongodb+srv://')) {
      const error = new Error('Invalid MONGODB_URI format!');
      console.error('❌ Invalid MONGODB_URI format!');
      console.error('   Connection string must start with "mongodb://" or "mongodb+srv://"');
      console.error('   Current value:', connectionString.substring(0, 50) + '...');
      throw error;
    }

    // Ensure database name is in the connection string
    if (!connectionString.includes('/') || connectionString.endsWith('/')) {
      const error = new Error('Invalid MONGODB_URI format! Database name missing');
      console.error('❌ Invalid MONGODB_URI format!');
      console.error('   Connection string must include database name after the host');
      console.error('   Example: mongodb+srv://user:pass@cluster.mongodb.net/revocart');
      throw error;
    }

    // Extract host and database name from connection string for logging
    const uriMatch = connectionString.match(/mongodb\+srv?:\/\/[^@]+@([^\/]+)\/([^?]+)/);
    const hostFromUri = uriMatch ? uriMatch[1] : 'unknown';
    const dbNameFromUri = uriMatch ? uriMatch[2] : 'revocart';
    
    console.log('🔄 Connecting to MongoDB...');
    console.log('   URI:', connectionString.replace(/:[^:@]+@/, ':****@'));
    console.log('   Host:', hostFromUri);
    console.log('   Database:', dbNameFromUri);
    console.log('   Timestamp:', new Date().toISOString());
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout (matches error message)
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Maintain at least 1 socket connection
    });

    // Verify connection
    const connection = mongoose.connection;
    
    // In serverless, connection properties might not be immediately available
    // Wait a moment for connection to fully establish
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In serverless environments, connection.host and connection.name might be undefined
    // Always use URI-extracted values as primary source (they're reliable)
    // Try to get actual connected host if available (for Atlas shard hosts)
    const actualHost = connection.host || hostFromUri;
    const actualDbName = connection.name || connection.db?.databaseName || dbNameFromUri;
    
    // Use the values we know are correct from the URI
    const displayHost = actualHost || hostFromUri;
    const displayDb = actualDbName || dbNameFromUri;
    
    console.log(`✅ MongoDB Connected`);
    console.log(`   Host: ${displayHost}`);
    console.log(`   Database: ${displayDb}`);
    console.log(`   Ready State: ${connection.readyState} (1=connected)`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Database connected successfully`);
  } catch (error: any) {
    console.error('\n❌ Error connecting to MongoDB:');
    const errorCode = error?.code || error?.cause?.code || 'UNKNOWN';
    const errorMessage = error?.message || 'No message';
    console.error('   Error Code:', errorCode);
    console.error('   Error Message:', errorMessage);
    
    // Show the connection string (masked) for debugging
    const maskedUri = MONGODB_URI?.replace(/:[^:@]+@/, ':****@') || 'not set';
    const envVarSet = !!process.env.MONGODB_URI;
    console.error('   Connection String:', maskedUri);
    console.error('   Env Var Set:', envVarSet ? 'Yes' : 'No');
    
    if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
      console.error('\n   ⚠️  Connection refused');
      console.error('   Your MONGODB_URI is pointing to a MongoDB server that is not reachable.');
      console.error('   If it is set to localhost (mongodb://localhost:27017/...), you must start MongoDB locally OR use MongoDB Atlas.');
      console.error('\n📝 Solution:');
      console.error('   1. If you want local MongoDB: install MongoDB and start the service (mongod)');
      console.error('   2. If you want MongoDB Atlas: set MONGODB_URI to your atlas string (mongodb+srv://...)');
      console.error('   3. On Vercel: add/update MONGODB_URI in Vercel → Project Settings → Environment Variables');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('\n   ⚠️  DNS lookup failed or connection timed out');
      console.error('   This usually means:');
      console.error('   - The cluster hostname is incorrect');
      console.error('   - Network/IP whitelist is blocking your connection');
      console.error('   - The cluster is paused or not accessible');
      console.error('\n📝 Solutions:');
      console.error('   1. Check MongoDB Atlas → Network Access → Add your IP (or 0.0.0.0/0 for testing)');
      console.error('   2. Verify the cluster hostname in your connection string is correct');
      console.error('   3. Check if your MongoDB Atlas cluster is running (not paused)');
    } else if (error.code === 'EAUTH' || error.message?.includes('authentication')) {
      console.error('\n   ⚠️  Authentication failed');
      console.error('   This means your username or password is incorrect.');
      console.error('\n📝 Solutions:');
      console.error('   1. Verify your database username in MongoDB Atlas → Database Access');
      console.error('   2. Make sure you replaced <password> with your actual password');
      console.error('   3. URL-encode special characters in password (e.g., @ becomes %40)');
      console.error('   4. Check if the database user has proper permissions');
    } else if (error.message?.includes('Invalid connection string') || error.message?.includes('Invalid URI')) {
      console.error('\n   ⚠️  Invalid connection string format detected');
      console.error('   The connection string is malformed or missing required parts.');
      console.error('\n📝 Common issues:');
      console.error('   1. Missing protocol (must start with mongodb:// or mongodb+srv://)');
      console.error('   2. Missing username or password');
      console.error('   3. Missing @ symbol before hostname');
      console.error('   4. Missing database name after hostname');
      console.error('   5. Extra spaces or newlines in the connection string');
      console.error('\n📝 Correct format:');
      console.error('   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/revocart?retryWrites=true&w=majority');
      console.error('\n📝 Check your .env file:');
      console.error('   1. Open api/.env');
      console.error('   2. Find the MONGODB_URI line');
      console.error('   3. Make sure it\'s all on one line (no line breaks)');
      console.error('   4. Ensure it starts with mongodb+srv://');
      console.error('   5. Remove any extra spaces or text');
    } else if (error.message?.includes('cluster0.tmaqm0h.mongodb.net')) {
      console.error('\n   ⚠️  Specific cluster connection issue detected');
      console.error('   Your connection string points to: cluster0.tmaqm0h.mongodb.net');
      console.error('\n📝 Check these in MongoDB Atlas:');
      console.error('   1. Go to https://cloud.mongodb.com/');
      console.error('   2. Select your cluster');
      console.error('   3. Click "Connect" → Check if cluster is running (not paused)');
      console.error('   4. Go to "Network Access" → Ensure your IP is whitelisted (0.0.0.0/0 for testing)');
      console.error('   5. Go to "Database Access" → Verify user exists and password is correct');
    } else {
      console.error('\n   ⚠️  Unexpected error occurred');
      if (error.message) {
        console.error(`   Details: ${error.message}`);
      }
    }
    
    console.error('\n📝 General Troubleshooting Steps:');
    console.error('   1. ✅ Verify MONGODB_URI in Vercel Environment Variables (check for typos)');
    console.error('   2. ✅ Check MongoDB Atlas cluster status (should be running, not paused)');
    console.error('   3. ✅ Verify Network Access → Add IP Address (0.0.0.0/0 for Vercel)');
    console.error('   4. ✅ Check Database Access → User exists with correct password');
    console.error('   5. ✅ URL-encode special characters in password (@ → %40, # → %23, etc.)');
    console.error('   6. ✅ Redeploy after updating environment variables');
    console.error('\n🔗 MongoDB Atlas Dashboard: https://cloud.mongodb.com/');
    
    // Always throw (never kill the process). Callers decide whether to exit.
    throw error;
  }
};

