import dotenv from 'dotenv';

// Load environment variables from .env file ONLY in development/local
// On Vercel, environment variables are automatically available via process.env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
import { validateEnv } from './config/validateEnv';

// Validate environment variables (non-blocking in serverless)
// Skip validation during build time - environment variables are not available during TypeScript compilation
// They will be available at runtime in Vercel
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  try {
    validateEnv();
  } catch (error: any) {
    console.error('⚠️  Environment validation warning:', error.message);
    // In development, fail fast
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
}

import express, { Application } from 'express';
import cors from 'cors';
import * as path from 'path';
import cookieParser from 'cookie-parser';
import storePublicRoutes from './routes/storePublicRoutes';
import storeProtectedRoutes from './routes/storeProtectedRoutes';
import pageBuilderRoutes from './routes/pageBuilder.routes';
import catalogRoutes from './routes/catalogRoutes';
import resellerRoutes from './routes/resellerRoutes';
import productRoutes from './routes/productRoutes';
import existingWebhookRoutes from './routes/webhookRoutes';
import pricingRoutes from './routes/pricingRoutes';
import checkoutRoutes from './routes/checkoutRoutes';
import reservationRoutes from './routes/reservationRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import payoutRoutes from './routes/payoutRoutes';
import shippingRoutes from './routes/shippingRoutes';
import rmaRoutes from './routes/rmaRoutes';
import couponRoutes from './routes/couponRoutes';
import referralRoutes from './routes/referralRoutes';
import eventRoutes from './routes/eventRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import authRoutes from './routes/authRoutes';
import adminUserRoutes from './routes/adminUser.routes';
import inviteRoutes from './routes/invite.routes';
import passwordResetRoutes from './routes/passwordReset.routes';
import emailVerificationRoutes from './routes/emailVerification.routes';
import sessionRoutes from './routes/session.routes';
import userProfileRoutes from './routes/userProfile.routes';
import customerOrdersRoutes from './routes/customerOrders.routes';
import auditLogRoutes from './routes/auditLog.routes';
import supplierKycRoutes from './routes/supplier.kyc.routes';
import supplierPayoutRoutes from './routes/supplier.payout.routes';
import supplierCatalogRoutes from './routes/supplier.catalog.routes';
import adminCatalogRoutes from './routes/admin.catalog.routes';
import supplierPriceUpdateRoutes from './routes/supplier.priceUpdate.routes';
import adminPriceUpdateRoutes from './routes/admin.priceUpdate.routes';
import adminKycRoutes from './routes/admin.kyc.routes';
import kycFileRoutes from './routes/kycFile.routes';
import adminApprovalRoutes from './routes/admin.approval.routes';
import adminProductRoutes from './routes/admin.product.routes';
import supplierProductRoutes from './routes/supplier.product.routes';
import adminCategoryRoutes from './routes/admin.category.routes';
import adminAttributeRoutes from './routes/admin.attribute.routes';
import adminVariantRoutes from './routes/admin.variant.routes';
import adminPayoutRoutes from './routes/admin.payout.routes';
import adminPricingRoutes from './routes/admin.pricing.routes';
import adminMarkupRoutes from './routes/admin.markup.routes';
import adminBrandRoutes from './routes/admin.brand.routes';
import alertRoutes from './routes/alert.routes';
import adminComplianceRoutes from './routes/admin.compliance.routes';
import adminPCIComplianceRoutes from './routes/admin.pciCompliance.routes';
import throttlingRoutes from './routes/throttling.routes';
import courierMappingRoutes from './routes/courierMapping.routes';
import labelGeneratorRoutes from './routes/labelGenerator.routes';
import unifiedTrackingRoutes from './routes/unifiedTracking.routes';
import fulfillmentRoutingRoutes from './routes/fulfillmentRouting.routes';
import unifiedRMARequestRoutes from './routes/unifiedRMARequest.routes';
import adminPlanRoutes from './routes/admin.plan.routes';
import adminSubscriptionRoutes from './routes/admin.subscription.routes';
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';
import stripeRoutes from './routes/stripeRoutes';
import paypalRoutes from './routes/paypalRoutes';
import paymentRecoveryRoutes from './routes/paymentRecoveryRoutes';
import codRoutes from './routes/codRoutes';
import deliveryRoutes from './routes/deliveryRoutes';
import paymentSwitchRoutes from './routes/paymentSwitchRoutes';
import webhookMonitoringRoutes from './routes/webhookMonitoringRoutes';
import adminCouponRoutes from './routes/admin.coupon.routes';
import adminPromotionRoutes from './routes/admin.promotion.routes';
import adminDynamicPricingRoutes from './routes/admin.dynamicPricing.routes';
import adminTaxRoutes from './routes/admin.tax.routes';
import adminShippingRoutes from './routes/admin.shipping.routes';
import adminReturnShippingRoutes from './routes/admin.returnShipping.routes';
import adminCourierRoutes from './routes/admin.courier.routes';
import shippingLabelRoutes from './routes/shippingLabel.routes';
import orderTrackingRoutes from './routes/orderTracking.routes';
import courierWebhookRoutes from './routes/courierWebhook.routes';
import cartRecoveryRoutes from './routes/cartRecovery.routes';
import adminStoreRoutes from './routes/admin.store.routes';
import adminPricingInsightsRoutes from './routes/admin.pricingInsights.routes';
import adminIPRestrictionRoutes from './routes/admin.ipRestriction.routes';
import adminSecurityRoutes from './routes/admin.security.routes';
import adminTemplateRoutes from './routes/admin.template.routes';
import invoiceRoutes from './routes/invoiceRoutes';
import financialReportsRoutes from './routes/financialReports.routes';
import orderLifecycleRoutes from './routes/orderLifecycle.routes';
import orderMessageRoutes from './routes/orderMessage.routes';
import salesAnalyticsRoutes from './routes/salesAnalytics.routes';
import conversionAnalyticsRoutes from './routes/conversionAnalytics.routes';
import analyticsDashboardRoutes from './routes/analyticsDashboard.routes';
import aovReportsRoutes from './routes/aovReports.routes';
import aovAnalyticsRoutes from './routes/aovAnalytics.routes';
import skuHeatmapRoutes from './routes/skuHeatmap.routes';
import advancedAnalyticsRoutes from './routes/advancedAnalytics.routes';
import deadStockRoutes from './routes/deadStock.routes';
import discountProposalRoutes from './routes/discountProposal.routes';
import marketingTrackingRoutes from './routes/marketingTracking.routes';
import attributionAnalyticsRoutes from './routes/attributionAnalytics.routes';
import tallyExportRoutes from './routes/tallyExport.routes';
import quickbooksExportRoutes from './routes/quickbooksExport.routes';
import xeroExportRoutes from './routes/xeroExport.routes';
import cryptoPaymentRoutes from './routes/cryptoPayment.routes';
import supplierKycTierRoutes from './routes/supplierKycTier.routes';
import documentVaultRoutes from './routes/documentVault.routes';
import imageOptimizationRoutes from './routes/imageOptimization.routes';
import storefrontRoutes from './routes/storefront.routes';
import themeVariantRoutes from './routes/themeVariant.routes';
import brandingRoutes from './routes/branding.routes';
// import { globalRateLimiter } from './middleware/rateLimit.global'; // DISABLED FOR DEV
import { csrfProtection } from './middleware/csrf.middleware';
import { errorHandler, notFound } from './middleware/errorHandler';
import { ipRestriction } from './middleware/ipRestriction';
import { attachRequestContext } from './context/requestContext';
import { referralTracker } from './middleware/referralTracker';

const app: Application = express();

// Middleware
// CORS configuration - support multiple origins for dev and production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  // Add custom origins from environment variable (comma-separated)
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.VERCEL_FRONTEND_URL ? [process.env.VERCEL_FRONTEND_URL] : []),
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files (labels)
app.use('/labels', express.static(path.join(process.cwd(), 'public', 'labels')));
// Serve optimized images
app.use('/uploads/optimized', express.static(path.join(process.cwd(), 'uploads', 'optimized')));
// KYC files are served through authenticated route (see kycFileRoutes below)

// Root route handler
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Revocart API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      api: '/api'
    }
  });
});

// API root handler (so `/api` doesn't fall through to store-scoped middleware and show "Store not found")
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Revocart API is running',
    endpoints: {
      auth: '/api/auth',
      health: '/health',
      ready: '/ready',
    },
    hint: 'Some /api/* routes require a store context via x-store-id header or a mapped subdomain/domain.',
  });
});

// Health check (excluded from rate limiting and store resolution)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Readiness probe (DB connectivity)
app.get('/ready', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const state = mongoose.connection.readyState;
    // 1: connected, 2: connecting
    if (state === 1) {
      res.json({ status: 'ok', db: 'connected' });
    } else {
      res.status(503).json({ status: 'degraded', db: 'not_connected' });
    }
  } catch (e) {
    res.status(503).json({ status: 'degraded', error: 'readiness_failed' });
  }
});

// DB Connection middleware - ensure DB is connected before handling requests
// This must be before routes that query the database
app.use(async (req, res, next) => {
  // Skip DB check for health endpoints and static assets
  const path = req.path || req.url;
  if (
    path === '/health' || 
    path === '/ready' || 
    path === '/' ||
    path.startsWith('/favicon') ||
    path === '/robots.txt' ||
    // Allow storefront to load even if DB is down (these endpoints already fall back to null/defaults)
    path === '/api/branding/active' ||
    path === '/api/theme/active' ||
    path.startsWith('/_next') ||
    path.startsWith('/static')
  ) {
    return next();
  }

  try {
    const mongoose = (await import('mongoose')).default;
    // Check if already connected (readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting)
    const readyState = mongoose.connection.readyState;
    if (readyState === 1) {
      return next();
    }

    // If connecting, wait a bit
    if (readyState === 2) {
      // Wait for connection (max 5 seconds)
      let attempts = 0;
      while (mongoose.connection.readyState !== 1 && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (mongoose.connection.readyState === 1) {
        return next();
      }
    }

    // Not connected - try to connect
    console.log('[MIDDLEWARE] MongoDB not connected, attempting connection...');
    console.log('[MIDDLEWARE] MONGODB_URI set:', !!process.env.MONGODB_URI);
    
    const { connectDB } = await import('./config/db');
    await connectDB();
    
    // Verify connection succeeded
    const mongooseCheck = (await import('mongoose')).default;
    if (mongooseCheck.connection.readyState === 1) {
      console.log('[MIDDLEWARE] MongoDB connected successfully');
      next();
    } else {
      throw new Error('MongoDB connection failed - readyState: ' + mongooseCheck.connection.readyState);
    }
  } catch (error: any) {
    const mongooseError = (await import('mongoose')).default;
    console.error('[MIDDLEWARE] DB connection error:', error?.message);
    console.error('[MIDDLEWARE] Error details:', {
      hasMongoUri: !!process.env.MONGODB_URI,
      readyState: mongooseError.connection.readyState,
      errorCode: error?.code,
      path: req.path || req.url,
    });
    
    // Don't send response if headers already sent
    if (res.headersSent) {
      return next(error);
    }
    
    res.status(503).json({
      success: false,
      message: 'Database connection failed. Please verify MONGODB_URI is set and MongoDB is reachable.',
      hint: !process.env.MONGODB_URI
        ? 'MONGODB_URI is not set. For local dev, add it to api/.env. For deployments, set it in your host environment variables.'
        : 'Check MongoDB Atlas Network Access (IP allowlist), credentials, and that your connection string includes a database name.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// IP restriction middleware (skip health and webhooks inside middleware)
app.use(ipRestriction);
app.use(attachRequestContext);

// Global rate limiter (applied to all routes except health check)
// app.use(globalRateLimiter); // DISABLED FOR DEV

// Public routes (no CSRF protection, no store resolution needed)
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/auth', emailVerificationRoutes);
app.use('/api/invites', inviteRoutes);

// Store resolution middleware - applies to all store-specific routes
// Resolves store from x-store-id header, subdomain, or domain
import { resolveStore, resolveStoreOptional } from './middleware/resolveStore';

// Storefront routes
// Note: /storefront/stores doesn't require store resolution, but /storefront/products does
// We'll handle this in the routes file by checking if store is needed
app.use('/api/storefront', storefrontRoutes);
app.use('/api/theme', themeVariantRoutes);
app.use('/api/branding', brandingRoutes);

// Protected routes (CSRF protection applied)
// Note: CSRF middleware skips GET/HEAD/OPTIONS automatically
app.use(csrfProtection);

// User profile routes (authenticated, CSRF protected)
app.use('/api/user', userProfileRoutes);

// Customer orders routes (authenticated, CSRF protected)
app.use('/api/customer', customerOrdersRoutes);

// Store routes - conditional routing based on path
// Public routes (creation, listing, themes) don't need store resolution
// Protected routes (by ID) require store resolution
app.use('/api/stores', (req, res, next) => {
  const path = req.path;
  const method = req.method.toUpperCase();
  
  // Check if this is a public route that doesn't need store resolution
  const isPublicRoute = 
    path === '/themes' ||
    path === '/create' ||
    (method === 'POST' && path === '/') ||
    (method === 'GET' && path === '/'); // GET /api/stores (with or without ownerId) doesn't need store resolution
  
  if (isPublicRoute) {
    // Handle as public route (no store resolution needed)
    return storePublicRoutes(req, res, next);
  } else {
    // Handle as protected route (requires store resolution)
    // Apply resolveStore middleware first
    return resolveStore(req, res, (err) => {
      if (err) return next(err);
      // Then handle with protected routes
      return storeProtectedRoutes(req, res, next);
    });
  }
});
app.use('/api/store/pages', resolveStore, pageBuilderRoutes);
app.use('/api/catalog', resolveStore, catalogRoutes);
app.use('/api/products', resolveStore, productRoutes);
app.use('/api/pricing', resolveStore, pricingRoutes);
app.use('/api/checkout', resolveStore, checkoutRoutes);
app.use('/api/reservations', reservationRoutes); // Reservation routes include resolveStore internally
app.use('/api/inventory', inventoryRoutes); // Inventory routes include resolveStore internally
app.use('/api/coupons', resolveStore, couponRoutes);
app.use('/api/analytics', resolveStore, analyticsRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin/audit-logs', auditLogRoutes);
// Store-specific routes already applied above with resolveStore
app.use('/api/reseller', resolveStore, resellerRoutes);
app.use('/api/webhooks', existingWebhookRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payouts', resolveStore, payoutRoutes);
app.use('/api/shipping', resolveStore, shippingRoutes);
app.use('/api/rma', resolveStore, rmaRoutes);
app.use('/api/referrals', resolveStore, referralRoutes);
app.use('/api/events', resolveStore, eventRoutes);
app.use('/api', cartRecoveryRoutes);

// WhatsApp webhooks (no auth required, signature verified separately)
import whatsappWebhookRoutes from './routes/whatsappWebhook.routes';
app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);

// SMS webhooks (no auth required, signature verification can be added)
import smsWebhookRoutes from './routes/smsWebhook.routes';
app.use('/webhooks/sms', smsWebhookRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/supplier/kyc', supplierKycRoutes);
app.use('/api/supplier/payouts', supplierPayoutRoutes);
app.use('/api/supplier/catalog', resolveStore, supplierCatalogRoutes);
app.use('/api/admin/catalog', resolveStore, adminCatalogRoutes);
app.use('/api/supplier/price-updates', resolveStore, supplierPriceUpdateRoutes);
app.use('/api/admin/price-updates', resolveStore, adminPriceUpdateRoutes);
app.use('/api/admin/kyc', adminKycRoutes);
app.use('/api/kyc/files', kycFileRoutes);
app.use('/api/admin/approvals', adminApprovalRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/supplier/products', supplierProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/attributes', adminAttributeRoutes);
app.use('/api/admin', adminVariantRoutes);
app.use('/api/admin/payouts', adminPayoutRoutes);
app.use('/api/admin/pricing-rules', adminPricingRoutes);
app.use('/api/admin/markup-rules', adminMarkupRoutes);
app.use('/api/admin/brands', adminBrandRoutes);
app.use('/api', alertRoutes);
app.use('/api/admin/pricing-compliance', adminComplianceRoutes);
app.use('/api/admin/pci-compliance', adminPCIComplianceRoutes); // PCI compliance routes
app.use('/api/admin/throttling', throttlingRoutes); // Throttling management routes
app.use('/api/courier-mapping', courierMappingRoutes); // Courier mapping routes
app.use('/api/admin/courier-mapping', courierMappingRoutes); // Admin courier mapping routes
app.use('/api/labels', labelGeneratorRoutes); // Label generator routes
app.use('/api/tracking', unifiedTrackingRoutes); // Unified tracking routes
app.use('/api/fulfillment-routing', fulfillmentRoutingRoutes); // Fulfillment routing routes
app.use('/api/rma-requests', unifiedRMARequestRoutes); // Unified RMA request routes
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/stripe', stripeRoutes); // Stripe payment routes (auth required)
// Stripe webhook (raw body for signature verification, NO auth)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeRoutes);
app.use('/api/payments/paypal', paypalRoutes); // PayPal payment routes (auth required)
// PayPal webhook (JSON body for signature verification, NO auth)
app.use('/api/webhooks/paypal', paypalRoutes);
app.use('/api/payments/recovery', paymentRecoveryRoutes); // Payment recovery routes
app.use('/api/orders/cod', codRoutes); // COD order routes
app.use('/api/delivery', deliveryRoutes); // Delivery partner routes
app.use('/api/payments/switch', paymentSwitchRoutes); // Payment switch routes
app.use('/api', cryptoPaymentRoutes); // Cryptocurrency payment routes
app.use('/api', supplierKycTierRoutes); // Supplier KYC tier routes
app.use('/api', documentVaultRoutes); // Document vault routes
app.use('/api/images', imageOptimizationRoutes); // Image optimization routes
app.use('/api/admin/webhooks', webhookMonitoringRoutes); // Webhook monitoring (admin only)
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin/coupons', adminCouponRoutes);
app.use('/api/admin/promotions', adminPromotionRoutes);
app.use('/api/admin/dynamic-pricing', adminDynamicPricingRoutes);
app.use('/api/admin', adminTaxRoutes);
app.use('/api/admin/shipping', adminShippingRoutes);
app.use('/api/admin/return-shipping-rules', resolveStore, adminReturnShippingRoutes);
app.use('/api/admin', adminCourierRoutes);
app.use('/api/admin', adminStoreRoutes);
app.use('/api/admin', adminPricingInsightsRoutes);
app.use('/api/admin', adminIPRestrictionRoutes);
app.use('/api/admin', adminSecurityRoutes);
app.use('/api/admin', adminTemplateRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', financialReportsRoutes);
app.use('/api', orderLifecycleRoutes);
app.use('/api', orderMessageRoutes); // Order message routes
app.use('/api', analyticsDashboardRoutes); // Admin dashboard analytics routes
app.use('/api', salesAnalyticsRoutes); // Sales analytics routes
app.use('/api', conversionAnalyticsRoutes); // Conversion analytics routes
app.use('/api', aovReportsRoutes); // AOV report endpoints (admin)
app.use('/api', resolveStore, aovAnalyticsRoutes); // AOV analytics routes
app.use('/api', resolveStore, skuHeatmapRoutes); // SKU heatmap analytics routes
app.use('/api', resolveStore, advancedAnalyticsRoutes); // Advanced analytics routes (geo, aging, price sensitivity, recommendations)
app.use('/api', resolveStore, deadStockRoutes); // Dead stock alert routes
app.use('/api', resolveStore, discountProposalRoutes); // Discount proposal routes
app.use('/api', marketingTrackingRoutes); // Marketing tracking routes (public, but requires store)
app.use('/api', resolveStore, attributionAnalyticsRoutes); // Attribution analytics routes
app.use('/api', tallyExportRoutes); // Tally accounting export routes
app.use('/api', quickbooksExportRoutes); // QuickBooks accounting export routes
app.use('/api', shippingLabelRoutes); // Shipping label routes
app.use('/api', orderTrackingRoutes); // Order tracking routes
app.use('/api/webhooks', courierWebhookRoutes); // Courier webhook routes

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;

