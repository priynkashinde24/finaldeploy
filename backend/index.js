/**
 * Backend Server Entry Point
 * This file serves as the main entry point for the backend server
 * It initializes the Express app, connects to MongoDB, and starts the server
 */

// Load environment variables (only in development)
require('dotenv').config({ path: require('path').join(__dirname, '../api/.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Get port from environment or default to 5000
const PORT = process.env.PORT || 5000;

// Backend deployment URL
const BACKEND_DEPLOY_URL = 'https://alonecloneweb-application.vercel.app/';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

const corsOrigins = [
  'https://alonecloneweb-application.vercel.app',
  'https://alonecloneweb-application-3-git-main-alone-clone.vercel.app',
  'https://aloneclone-frontend.vercel.app',
  // Add more origins as needed (uncomment and add your URLs):
  // 'https://your-frontend.vercel.app',
  // 'https://www.yourdomain.com',
  // 'https://app.yourdomain.com',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.VERCEL_FRONTEND_URL ? [process.env.VERCEL_FRONTEND_URL] : []),
  // Support ALLOWED_ORIGINS environment variable (comma-separated)
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []),
].filter(Boolean);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  ...corsOrigins,
].filter(Boolean);

// Enhanced CORS configuration for Vercel
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow all Vercel frontend domains (*.vercel.app) - this is the key fix
    if (origin.includes('.vercel.app')) {
      console.log(`[CORS] Allowing Vercel origin: ${origin}`);
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow localhost variations
      if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
        callback(null, true);
      } else {
        // Log the blocked origin for debugging
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Store-Id', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Explicitly handle OPTIONS requests for CORS preflight
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/labels', express.static(path.join(process.cwd(), 'public', 'labels')));

// Middleware to ensure MongoDB connection (for serverless environments)
app.use(async (req, res, next) => {
  // Skip DB check for health endpoints
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }
  
  // Ensure MongoDB is connected before handling requests
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (error) {
      // If connection fails, still allow request but log error
      console.warn('⚠️  MongoDB not connected, request may fail:', error.message);
    }
  }
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Revocart API is running',
    version: '1.0.0',
    backendUrl: BACKEND_DEPLOY_URL,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      ready: '/ready',
      api: '/api'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (checks database connectivity)
app.get('/ready', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    if (state === 1) {
      res.json({ 
        status: 'ok', 
        db: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'degraded', 
        db: 'not_connected',
        state: state,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return;
    }

    // Validate MONGODB_URI
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not set! Please set it in environment variables.');
    }

    console.log('🔄 Connecting to MongoDB...');
    console.log('   URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
    });

    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('\n🔴 MONGODB ATLAS IP WHITELIST ISSUE');
      console.error('   Your IP address is not whitelisted in MongoDB Atlas.');
      console.error('   For Vercel deployments, you need to:');
      console.error('   1. Go to MongoDB Atlas → Network Access');
      console.error('   2. Click "Add IP Address"');
      console.error('   3. Click "Allow Access from Anywhere" (adds 0.0.0.0/0)');
      console.error('   4. Click "Confirm"');
      console.error('   This allows Vercel\'s servers to connect to your database.');
      console.error('   More info: https://www.mongodb.com/docs/atlas/security-whitelist/\n');
    } else if (error.message.includes('authentication')) {
      console.error('\n🔴 MONGODB AUTHENTICATION ISSUE');
      console.error('   Check your MongoDB username and password in MONGODB_URI');
      console.error('   Make sure special characters in password are URL-encoded:');
      console.error('   - @ becomes %40');
      console.error('   - # becomes %23');
      console.error('   - etc.\n');
    } else {
      console.error('📝 Please check your MONGODB_URI environment variable');
      console.error('   Make sure it\'s set in Vercel: Settings → Environment Variables');
    }
    
    throw error;
  }
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Start server
const startServer = async () => {
  try {
    // For Vercel serverless, don't block startup on DB connection
    // Connect to database, but don't fail if it's not available yet
    if (process.env.VERCEL) {
      // In Vercel, try to connect but don't block
      connectDB().catch(err => {
        console.warn('⚠️  MongoDB connection failed on startup (will retry on first request):', err.message);
      });
    } else {
      // In traditional server mode, wait for DB connection
      await connectDB();
    }

    // Start listening (only if not in Vercel serverless mode)
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log('\n🚀 Backend Server Started');
        console.log(`   Port: ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Health Check: http://localhost:${PORT}/health`);
        console.log(`   Ready Check: http://localhost:${PORT}/ready`);
        console.log(`   API Root: http://localhost:${PORT}/\n`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    // In Vercel, don't exit - let the function handle errors
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;

