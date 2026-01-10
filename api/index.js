/**
 * Backend Entry Point - MongoDB Connection Configuration
 * This file sets up the MongoDB Atlas connection string
 * 
 * For Vercel deployment, this file ensures the MongoDB URI is available
 * as an environment variable. The actual API is served from api/api/index.ts
 */

// MongoDB Atlas Connection String
const MONGODB_URI = 'mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart';

// Export for use in other files
module.exports = {
  MONGODB_URI
};

// Also set as environment variable if not already set
// In Vercel, MONGODB_URI should be set in environment variables
// This is a fallback for local development
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = MONGODB_URI;
  console.log('✅ MongoDB URI set from index.js (fallback for local dev)');
} else {
  console.log('✅ MongoDB URI found in environment variables');
}

console.log('📦 MongoDB Atlas Connection String configured:');
console.log('   Database: revocart');
console.log('   Cluster: cluster0.mzws36m.mongodb.net');
console.log('   ⚠️  For production, set MONGODB_URI in Vercel environment variables');
