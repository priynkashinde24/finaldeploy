/**
 * MongoDB Migration Script
 * Migrates data from local MongoDB to MongoDB Atlas
 * 
 * Usage: node migrate-to-atlas.js
 * 
 * Make sure:
 * 1. Local MongoDB is running on localhost:27017
 * 2. You have internet connection to access MongoDB Atlas
 * 3. Your IP is whitelisted in MongoDB Atlas (or use 0.0.0.0/0 for testing)
 */

import { MongoClient } from 'mongodb';

// Connection strings
const LOCAL_URI = 'mongodb://localhost:27017/revocart';
const ATLAS_URI = 'mongodb+srv://admin:Priyanka@98@cluster0.mzws36m.mongodb.net/revocart';

async function migrateDatabase() {
  let localClient = null;
  let atlasClient = null;

  try {
    console.log('🔄 Starting database migration...\n');
    console.log('📋 Source: Local MongoDB (mongodb://localhost:27017/revocart)');
    console.log('📋 Destination: MongoDB Atlas (cluster0.mzws36m.mongodb.net/revocart)\n');

    // Connect to local MongoDB
    console.log('📡 Connecting to local MongoDB...');
    localClient = new MongoClient(LOCAL_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    await localClient.connect();
    console.log('✅ Connected to local MongoDB\n');

    // Connect to MongoDB Atlas
    console.log('📡 Connecting to MongoDB Atlas...');
    atlasClient = new MongoClient(ATLAS_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    await atlasClient.connect();
    console.log('✅ Connected to MongoDB Atlas\n');

    const localDb = localClient.db('revocart');
    const atlasDb = atlasClient.db('revocart');

    // Get all collection names from local database
    const collections = await localDb.listCollections().toArray();
    console.log(`📦 Found ${collections.length} collections to migrate:\n`);

    if (collections.length === 0) {
      console.log('⚠️  No collections found in local database. Nothing to migrate.');
      return;
    }

    // List all collections
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });
    console.log('');

    let totalMigrated = 0;
    let totalSkipped = 0;

    // Migrate each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`🔄 Migrating collection: ${collectionName}...`);

      const localCollection = localDb.collection(collectionName);
      const atlasCollection = atlasDb.collection(collectionName);

      // Get all documents from local collection
      const documents = await localCollection.find({}).toArray();
      console.log(`   Found ${documents.length} documents`);

      if (documents.length === 0) {
        console.log(`   ⚠️  Collection ${collectionName} is empty, skipping...\n`);
        totalSkipped++;
        continue;
      }

      // Check if collection already exists in Atlas
      const existingDocs = await atlasCollection.countDocuments();
      if (existingDocs > 0) {
        console.log(`   ⚠️  Collection already has ${existingDocs} documents in Atlas`);
        console.log(`   ⏭️  Skipping ${collectionName} to avoid duplicates...\n`);
        totalSkipped++;
        continue;
      }

      // Insert documents into Atlas
      if (documents.length > 0) {
        try {
          // Insert in batches of 1000 for better performance
          const batchSize = 1000;
          let inserted = 0;
          
          for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            const result = await atlasCollection.insertMany(batch, { ordered: false });
            inserted += result.insertedCount;
          }
          
          console.log(`   ✅ Successfully migrated ${inserted} documents\n`);
          totalMigrated += inserted;
        } catch (error) {
          if (error.code === 11000) {
            console.log(`   ⚠️  Some documents already exist (duplicate key error), continuing...\n`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('✅ Migration completed!\n');

    // Show summary
    console.log('📊 Migration Summary:');
    console.log('─'.repeat(50));
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const localCollection = localDb.collection(collectionName);
      const atlasCollection = atlasDb.collection(collectionName);
      const localCount = await localCollection.countDocuments();
      const atlasCount = await atlasCollection.countDocuments();
      const status = localCount === atlasCount ? '✅' : '⚠️';
      console.log(`   ${status} ${collectionName}: ${localCount} → ${atlasCount} documents`);
    }
    console.log('─'.repeat(50));
    console.log(`\n   Total migrated: ${totalMigrated} documents`);
    console.log(`   Collections skipped: ${totalSkipped}`);

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Make sure local MongoDB is running:');
      console.error('      - Windows: Check if MongoDB service is running');
      console.error('      - Or run: mongod --dbpath "C:\\data\\db"');
      console.error('   2. For Atlas connection issues:');
      console.error('      - Check your internet connection');
      console.error('      - Verify your IP is whitelisted in MongoDB Atlas');
      console.error('      - Check if the connection string is correct');
    }
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Close connections
    if (localClient) {
      await localClient.close();
      console.log('\n🔌 Closed local MongoDB connection');
    }
    if (atlasClient) {
      await atlasClient.close();
      console.log('🔌 Closed MongoDB Atlas connection');
    }
  }
}

// Run migration
console.log('🚀 MongoDB Migration Tool');
console.log('='.repeat(50));
migrateDatabase()
  .then(() => {
    console.log('\n🎉 All done! Your data has been migrated to MongoDB Atlas.');
    console.log('💡 Next step: Update your MONGODB_URI environment variable');
    console.log('   to: mongodb+srv://admin:Priyanka@98@cluster0.mzws36m.mongodb.net/revocart');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });

