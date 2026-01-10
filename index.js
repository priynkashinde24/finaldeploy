/**
 * Vercel Serverless Function Entry Point
 * This file handles backend connectivity for Vercel deployment
 * 
 * IMPORTANT: For Vercel deployment, this file should work with the existing
 * TypeScript setup. The api/api/index.ts file already handles everything.
 * 
 * This file can be used as an alternative entry point if needed.
 */

// Load environment variables (only in development)
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// For Vercel, we recommend using the existing api/api/index.ts file
// which is already configured for serverless functions.
// 
// If you want to use this index.js file instead, you'll need to:
// 1. Compile TypeScript first (npm run build in api folder)
// 2. Or use a build step that compiles TypeScript before deployment
//
// The recommended approach is to keep using api/api/index.ts in vercel.json

// MongoDB connection handler (cached for serverless)
import mongoose from 'mongoose';

let isConnected = false;
let connectionPromise = null;

const ensureDBConnection = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      // Get MongoDB URI from environment variable (recommended for production)
      // Or use a fallback URL for development (NOT recommended for production)
      let MONGODB_URI = process.env.MONGODB_URI;
      
      // Fallback for development (REMOVE THIS IN PRODUCTION - use environment variables instead)
      // Uncomment and add your MongoDB URL below for local testing only:
      // MONGODB_URI = MONGODB_URI || 'mongodb+srv://username:password@cluster.mongodb.net/database';
      
      if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI not set!');
        console.error('📝 Please add MONGODB_URI to your environment variables:');
        console.error('   - For Vercel: Settings → Environment Variables → Add MONGODB_URI');
        console.error('   - For local: Create .env file with MONGODB_URI=your_connection_string');
        throw new Error('MONGODB_URI environment variable is required');
      }

      if (mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
      }

      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        w: 'majority',
        maxPoolSize: 1,
        minPoolSize: 0,
      });

      isConnected = true;
      console.log('✅ MongoDB connected');
      
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err);
        isConnected = false;
        connectionPromise = null;
      });

      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        connectionPromise = null;
      });
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      isConnected = false;
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

// Import the app from the existing TypeScript serverless function
// Note: This requires the TypeScript to be compiled or Vercel to handle it
// The existing api/api/index.ts already exports the app properly
import apiHandler from './api/api/index.ts';

const app = apiHandler.default || apiHandler;

// Vercel serverless function handler
export default async (req, res) => {
  // Ensure DB connection (non-blocking)
  ensureDBConnection().catch((err) => {
    console.error('DB connection error:', err.message);
  });

  // Handle request with Express app
  return app(req, res);
};
