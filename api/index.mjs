/**
 * Backend Entry Point - MongoDB Connection Configuration
 * This file sets up the MongoDB Atlas connection string
 */

// MongoDB Atlas Connection String
const MONGODB_URI = 'mongodb+srv://admin:Priyanka%4098@cluster0.mzws36m.mongodb.net/revocart';

// Export for use in other files
export { MONGODB_URI };

// Also set as environment variable if not already set
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = MONGODB_URI;
  console.log('✅ MongoDB URI set from index.mjs');
}

console.log('📦 MongoDB Atlas Connection String configured:');
console.log('   Database: revocart');
console.log('   Cluster: cluster0.mzws36m.mongodb.net');

