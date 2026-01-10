import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { MagicLink } from '../models/MagicLink';
import { OTP } from '../models/OTP';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken, generateTokenId } from '../utils/jwt';
import { generateMagicLinkToken, hashMagicLinkToken } from '../utils/magicLinkToken';
import { generateOTP, hashOTP, normalizePhoneNumber, isValidPhoneNumber } from '../utils/otpToken';
import { sendOTP as sendOTPSMS } from '../utils/sms';
import { logSecurityEvent } from '../utils/securityLogger';
import { registerFailedAttempt, clearAttempts } from '../utils/bruteForceGuard';
import { safeDbQuery } from '../utils/safeDbQuery';
import { z } from 'zod';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Registration payload schema.
 *
 * Be tolerant to support multiple frontends/clients:
 * - `role` is optional and defaults to `reseller`
 * - role is case-insensitive and supports common aliases (vendor/customer/etc.)
 * - allow `fullName` as an alternative to `name`
 */
const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .optional(),
    fullName: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z
      .preprocess(
        (val) => (typeof val === 'string' ? val.toLowerCase().trim() : val),
        z
          .enum(['admin', 'supplier', 'reseller', 'vendor', 'customer', 'delivery', 'affiliate'])
          .optional()
      )
      .default('reseller'),
  })
  .superRefine((data, ctx) => {
    if (!data.name && !data.fullName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Name is required',
      });
    }
  })
  .transform((data) => {
    const rawRole = data.role;
    const normalizedRole =
      rawRole === 'vendor' ? 'supplier' : rawRole === 'customer' || rawRole === 'delivery' ? 'reseller' : rawRole;
    return {
      name: (data.name ?? data.fullName ?? '').trim(),
      email: data.email,
      password: data.password,
      role: normalizedRole as 'admin' | 'supplier' | 'reseller' | 'affiliate',
    };
});

/**
 * POST /auth/register
 * Register a new user
 * Restrictions:
 * - Only admin can create supplier/admin
 * - Reseller can self-register
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[REGISTER] Raw request body:', req.body);

    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    console.log('[REGISTER] Validation passed:', validatedData);
    const { name, email, password, role } = validatedData;
    const normalizedEmail = email.toLowerCase().trim();

    // Ensure MongoDB connection before database operations (same pattern as login)
    const mongoose = (await import('mongoose')).default;

    // Helper to verify connection is actually usable (not just "readyState = 1")
    const verifyConnectionReady = async (): Promise<boolean> => {
      if (mongoose.connection.readyState !== 1) return false;
      try {
        await mongoose.connection.db?.admin().ping();
        return true;
      } catch (error) {
        console.warn('[REGISTER] Connection ping failed, connection may not be ready:', error);
        return false;
      }
    };

    if (mongoose.connection.readyState !== 1 || !(await verifyConnectionReady())) {
      console.log('[REGISTER] MongoDB not connected or not ready, attempting connection...');
      const { connectDB } = await import('../config/db');
      try {
        await connectDB();

        // Wait briefly for connection to stabilize and verify it's actually ready
        let attempts = 0;
        while (attempts < 50) {
          if (mongoose.connection.readyState === 1 && (await verifyConnectionReady())) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (mongoose.connection.readyState !== 1 || !(await verifyConnectionReady())) {
          throw new Error('MongoDB connection failed or not ready - readyState: ' + mongoose.connection.readyState);
        }
      } catch (dbError: any) {
        console.error('[REGISTER] Database connection error:', dbError?.message);
        sendError(
          res,
          'Database connection failed. Please verify MONGODB_URI is set and MongoDB Atlas Network Access allows your IP (for testing: 0.0.0.0/0).',
          503
        );
        return;
      }
    }

    // Check if user already exists
    let existingUser;
    try {
      existingUser = await safeDbQuery(
        User.findOne({ email: normalizedEmail }).maxTimeMS(8000),
        8000,
        'Registration request timed out. Please try again.'
      );
    } catch (dbError: any) {
      console.error('[REGISTER] Error finding user:', dbError?.message);
      sendError(res, dbError?.message || 'Database operation failed. Please try again.', 503);
      return;
    }
    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Role-based registration restrictions
    // Get current user from request (if authenticated)
    const currentUser = (req as any).user;

    // If trying to register as admin or supplier
    if (role === 'admin' || role === 'supplier') {
      // Only admin can create admin/supplier
      if (!currentUser || currentUser.role !== 'admin') {
        sendError(res, 'Only admins can create admin or supplier accounts', 403);
        return;
      }
    }
    // Reseller can self-register (no restrictions)

    // Hash password using bcrypt
    const passwordHash = await hashPassword(password);

    // Approval rules:
    // - Resellers can self-register and should be able to login immediately (auto-approved)
    // - Admin/supplier accounts require an existing admin (already enforced above) and are auto-approved when created by an admin
    // - In development, auto-approve all users for easier testing
    const isAdmin = role === 'admin';
    const isReseller = role === 'reseller';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const createdByAdmin = !!currentUser && currentUser.role === 'admin';
    
    const shouldAutoApprove = isDevelopment || isReseller || isAdmin || createdByAdmin;
    
    // Create new user
    const user = new User({
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      isActive: shouldAutoApprove, // Auto-active in dev, or if admin
      isEmailVerified: true, // TEMP: Set to true for testing (remove in production)
      isBlocked: false,
      approvalStatus: shouldAutoApprove ? 'approved' : 'pending', // Auto-approved in dev or if admin
      approvedAt: shouldAutoApprove ? new Date() : null, // Auto-approved in dev or if admin
      approvedBy: createdByAdmin ? currentUser.id : null, // If created by an admin, record who approved
      rejectionReason: null,
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    // Marketing attribution (capture before saving)
    try {
      const { getAttributionFromRequest } = await import('../services/attributionService');
      const attribution = await getAttributionFromRequest(req, 'last_touch');
      
      if (attribution) {
        user.marketingAttribution = {
          firstTouch: attribution.firstTouch,
          lastTouch: attribution.lastTouch,
          signupChannel: attribution.signupChannel || attribution.lastTouch?.channel || 'direct',
          attributedAt: new Date(),
        };
      }
    } catch (error: any) {
      // Don't fail signup if attribution fails
      console.error('[AUTH] Error capturing marketing attribution:', error);
    }

    // Save user with timeout handling
    try {
      await safeDbQuery(
        user.save(),
        10000,
        'Registration timed out while creating your account. Please try again.'
      );
    } catch (dbError: any) {
      console.error('[REGISTER] Error saving new user:', dbError?.message);
      sendError(res, dbError?.message || 'Failed to create user. Please try again.', 503);
      return;
    }

    // Referral attribution (if referral code exists in cookie)
    const referralCode = req.cookies?.referral_code;
    const storeId = req.store?.storeId;
    if (referralCode && storeId) {
      try {
        const { ReferralCode } = await import('../models/ReferralCode');
        const { ReferralVisit } = await import('../models/ReferralVisit');
        const { UserReferral } = await import('../models/UserReferral');
        const { logAudit } = await import('../utils/auditLogger');
        const { eventStreamEmitter } = await import('./eventController');
        const mongoose = await import('mongoose');

        const code = await ReferralCode.findOne({
          storeId: new mongoose.Types.ObjectId(storeId),
          code: referralCode.toUpperCase(),
          status: 'active',
        }).lean();

        if (code && (!code.expiresAt || code.expiresAt > new Date())) {
          // Prevent self-referral
          if (code.ownerId.toString() !== user._id.toString()) {
            // Create UserReferral link
            const userReferral = new UserReferral({
              userId: user._id,
              storeId: new mongoose.Types.ObjectId(storeId),
              referralCode: code.code,
              referrerId: code.ownerId,
              referrerType: code.ownerType,
              linkedAt: new Date(),
            });
            await userReferral.save();

            // Update ReferralVisit with convertedUserId
            const visitorId = req.cookies?.visitor_id;
            if (visitorId) {
              await ReferralVisit.updateOne(
                { visitorId, referralCode: code.code },
                {
                  $set: {
                    convertedUserId: user._id,
                    convertedAt: new Date(),
                  },
                }
              );
            }

            // Audit log
            await logAudit({
              storeId: storeId.toString(),
              actorRole: 'system',
              action: 'REFERRAL_CONVERSION',
              entityType: 'UserReferral',
              entityId: userReferral._id.toString(),
              description: `User signed up with referral code: ${code.code}`,
              metadata: {
                referralCode: code.code,
                referrerId: code.ownerId.toString(),
                referrerType: code.ownerType,
                userId: user._id.toString(),
              },
            });

            // Emit event
            eventStreamEmitter.emit('event', {
              eventType: 'REFERRAL_SIGNUP',
              payload: {
                referralCode: code.code,
                referrerId: code.ownerId.toString(),
                userId: user._id.toString(),
              },
              storeId: storeId.toString(),
              occurredAt: new Date(),
            });
          }
        }
      } catch (error: any) {
        // Don't fail registration on referral attribution error
        console.error('[REFERRAL ATTRIBUTION] Error:', error);
      }
    }

    // Automatically send verification email
    try {
      const { sendVerificationEmailForUser } = await import('../utils/sendVerificationEmail');
      await sendVerificationEmailForUser(user._id.toString(), user.email);
    } catch (error: any) {
      // Don't fail signup if email sending fails (common in dev/misconfigured SMTP)
      console.error('[REGISTER] Failed to send verification email (non-fatal):', error?.message || error);
    }

    // Return success (NO auto-login per requirements)
    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      'Registration successful. Please login.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/login
 * Login user and generate tokens
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[LOGIN] Login request received:', { email: req.body.email });
    
    // Ensure MongoDB connection before database operations
    const mongoose = (await import('mongoose')).default;
    const connectionState = mongoose.connection.readyState;
    
    // Helper function to verify connection is actually ready
    const verifyConnectionReady = async (): Promise<boolean> => {
      if (mongoose.connection.readyState !== 1) {
        return false;
      }
      
      // Try a simple ping to verify connection is actually working
      try {
        await mongoose.connection.db?.admin().ping();
        return true;
      } catch (error) {
        console.warn('[LOGIN] Connection ping failed, connection may not be ready:', error);
        return false;
      }
    };
    
    if (connectionState !== 1 || !(await verifyConnectionReady())) {
      console.log('[LOGIN] MongoDB not connected or not ready, attempting connection...');
      console.log('[LOGIN] Current readyState:', connectionState);
      const { connectDB } = await import('../config/db');
      try {
        await connectDB();
        // Wait for connection to stabilize and verify it's actually ready
        let attempts = 0;
        while (attempts < 50) {
          if (mongoose.connection.readyState === 1) {
            // Connection state is 1, but verify it's actually ready
            if (await verifyConnectionReady()) {
              console.log('[LOGIN] MongoDB connected and verified successfully');
              break;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        // Final verification
        if (mongoose.connection.readyState !== 1 || !(await verifyConnectionReady())) {
          throw new Error('MongoDB connection failed or not ready - readyState: ' + mongoose.connection.readyState);
        }
      } catch (dbError: any) {
        console.error('[LOGIN] Database connection error:', dbError?.message);
        console.error('[LOGIN] Connection details:', {
          readyState: mongoose.connection.readyState,
          hasDb: !!mongoose.connection.db,
          host: mongoose.connection.host,
        });
        sendError(
          res,
          'Database connection failed. Please verify MONGODB_URI is set and MongoDB Atlas Network Access allows your IP (for testing: 0.0.0.0/0).',
          503
        );
        return;
      }
    }
    
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Extract client IP for security logging / brute force
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const clientIp =
      (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim() : null) ||
      (Array.isArray(realIp) ? realIp[0] : realIp) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    // Find user and include passwordHash field with timeout handling
    let user;
    try {
      user = await safeDbQuery(
        User.findOne({ email }).select('+passwordHash').maxTimeMS(8000),
        8000,
        'Login request timed out. Please try again.'
      );
    } catch (dbError: any) {
      console.error('[LOGIN] Error finding user:', dbError?.message);
      if (dbError?.message?.includes('buffering') || dbError?.message?.includes('timeout')) {
        sendError(res, 'Database operation timed out. Please verify MongoDB connection is working and try again.', 503);
        return;
      }
      throw dbError; // Re-throw other errors
    }

    if (!user) {
      console.log('[LOGIN] User not found:', email);
      // Audit log: Login failed (user not found)
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorRole: 'reseller', // Default (no user found)
        action: 'LOGIN_FAILED',
        entityType: 'User',
        description: `Failed login attempt for email: ${email}`,
        metadata: {
          email,
          reason: 'user_not_found',
        },
      });

      // Security log + brute force detection
      await logSecurityEvent({
        req,
        eventType: 'LOGIN_FAILED',
        severity: 'medium',
        metadata: { email, reason: 'user_not_found', ip: clientIp },
      });
      const { ipFlagged, emailFlagged } = registerFailedAttempt(clientIp, email);
      if (ipFlagged || emailFlagged) {
        await logSecurityEvent({
          req,
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'high',
          metadata: { email, ip: clientIp, reason: 'brute_force_threshold' },
        });
      }

      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Note: don't block on isActive before validating password.
    // We handle inactive/pending/blocked checks after password verification to avoid leaking account state.

    // Check if account is locked
    const maxLoginAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
    const lockTimeMinutes = parseInt(process.env.LOGIN_LOCK_TIME_MINUTES || '30', 10);

    if (user.lockUntil && user.lockUntil > new Date()) {
      // Account is still locked
      sendError(res, 'Account temporarily locked due to multiple failed login attempts. Please try again later.', 423);
      return;
    }

    // If lockUntil has passed, reset the lock
    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.lockUntil = null;
      user.failedLoginAttempts = 0;
      await user.save();
    }

    console.log('[LOGIN] User found:', { id: user._id.toString(), email: user.email, role: user.role, isActive: user.isActive, isEmailVerified: user.isEmailVerified });
    
    // Check password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    console.log('[LOGIN] Password match:', isPasswordValid);

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lock account if max attempts reached
      if (user.failedLoginAttempts >= maxLoginAttempts) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + lockTimeMinutes);
        user.lockUntil = lockUntil;

        // Audit log: Account locked
        const { logAudit } = await import('../utils/auditLogger');
        await logAudit({
          req,
          actorId: user._id.toString(),
          actorRole: user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system',
          action: 'ACCOUNT_LOCKED',
          entityType: 'User',
          entityId: user._id.toString(),
          description: `Account locked due to ${user.failedLoginAttempts} failed login attempts`,
          metadata: {
            email: user.email,
            failedAttempts: user.failedLoginAttempts,
            lockUntil: lockUntil.toISOString(),
          },
        });
      }

      await user.save();

      // Audit log: Login failed (invalid password)
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Failed login attempt - invalid password (${user.failedLoginAttempts}/${maxLoginAttempts} attempts)`,
        metadata: {
          email: user.email,
          reason: 'invalid_password',
          failedAttempts: user.failedLoginAttempts,
        },
      });

      // Security log + brute force detection
      await logSecurityEvent({
        req,
        eventType: 'LOGIN_FAILED',
        severity: 'medium',
        metadata: { email: user.email, reason: 'invalid_password', ip: clientIp, failedAttempts: user.failedLoginAttempts },
      });
      const { ipFlagged, emailFlagged } = registerFailedAttempt(clientIp, user.email);
      if (ipFlagged || emailFlagged) {
        await logSecurityEvent({
          req,
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'high',
          metadata: { email: user.email, ip: clientIp, reason: 'brute_force_threshold' },
        });
      }

      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Successful login - reset failed attempts and lock
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // Check approval status immediately after password validation
    // In development, auto-approve and allow login (for easier testing)
    // In production, only approved users (or admins) can login
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isAdmin = user.role === 'admin';
    const isApproved = user.approvalStatus === 'approved';
    
    // Auto-approval rules:
    // - Dev: auto-approve pending users (except admins who are already approved)
    // - Prod: resellers are self-service and should be able to login even if created as pending by older deployments
    const isReseller = user.role === 'reseller';

    if ((!isApproved && !isAdmin) && (isDevelopment || isReseller)) {
      console.log(
        `[LOGIN] Auto-approving ${isDevelopment ? 'dev' : 'reseller'} user:`,
        user.email
      );
      user.approvalStatus = 'approved';
      user.approvedAt = new Date();
      user.isActive = true;
      await user.save();
      console.log('[LOGIN] User auto-approved and activated');
    }
    
    // In production: block login if not approved (admins always allowed)
    if (!isDevelopment && !isAdmin && user.approvalStatus !== 'approved') {
      // Audit log: Login failed (account pending admin approval)
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Failed login attempt - account pending admin approval`,
        metadata: {
          email: user.email,
          reason: 'account_pending_approval',
          approvalStatus: user.approvalStatus,
        },
      });
      sendError(res, 'Account pending admin approval', 403);
      return;
    }

    // Legacy safeguard: if a reseller is already approved but inactive, activate them at login.
    // Admins can still disable access by setting `isBlocked=true`.
    if (!isDevelopment && isReseller && user.approvalStatus === 'approved' && !user.isBlocked && !user.isActive) {
      console.log('[LOGIN] Activating approved reseller (legacy inactive):', user.email);
      user.isActive = true;
      await user.save();
    }

    // Check if user is blocked - block blocked users from logging in
    if (user.isBlocked) {
      // Audit log: Login failed (account blocked)
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Failed login attempt - account blocked by admin`,
        metadata: {
          email: user.email,
          reason: 'account_blocked',
        },
      });
      sendError(res, 'Account blocked by admin', 403);
      return;
    }

    // Check if user is active - block inactive users from logging in
    if (!user.isActive) {
      // Audit log: Login failed (account inactive)
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Failed login attempt - account inactive`,
        metadata: {
          email: user.email,
          reason: 'account_inactive',
        },
      });
      sendError(res, 'Account is inactive', 403);
      return;
    }

    // Check if email is verified - block unverified users from logging in
    // In development, auto-verify email during login (for easier testing)
    if (!user.isEmailVerified) {
      // In development mode: auto-verify email
      if (isDevelopment) {
        console.log('[LOGIN] Development mode: Auto-verifying email for user:', user.email);
        user.isEmailVerified = true;
        await user.save();
        console.log('[LOGIN] Email auto-verified');
      } else {
        // In production: block login if email not verified
        // Audit log: Login failed (email not verified)
        const { logAudit } = await import('../utils/auditLogger');
        await logAudit({
          req,
          actorId: user._id.toString(),
          actorRole: user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system',
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user._id.toString(),
          description: `Failed login attempt - email not verified`,
          metadata: {
            email: user.email,
            reason: 'email_not_verified',
          },
        });
        sendError(res, 'Please verify your email to continue', 403);
        return;
      }
    }

    // Check KYC approval for suppliers
    if (user.role === 'supplier') {
      const { SupplierKYC } = await import('../models/SupplierKYC');
      const supplierKYC = await SupplierKYC.findOne({ supplierId: user._id });
      
      if (!supplierKYC || supplierKYC.status !== 'approved') {
        // Audit log: Login failed (KYC not approved)
        const { logAudit } = await import('../utils/auditLogger');
        await logAudit({
          req,
          actorId: user._id.toString(),
          actorRole: user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system',
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: user._id.toString(),
          description: `Failed login attempt - KYC not approved yet`,
          metadata: {
            email: user.email,
            reason: 'kyc_not_approved',
            kycStatus: supplierKYC?.status || 'not_submitted',
          },
        });
        sendError(res, 'KYC not approved yet', 403);
        return;
      }
    }

    // STEP 5: Resolve store and verify user access
    let resolvedStoreId: string | null = null;
    const { Store } = await import('../models/Store');
    
    // Try to resolve store from header, subdomain, or domain
    const headerStoreId = req.headers['x-store-id'] as string;
    const host = Array.isArray(req.headers.host) 
      ? req.headers.host[0] 
      : req.headers.host || 
        (Array.isArray(req.headers['x-forwarded-host']) 
          ? req.headers['x-forwarded-host'][0] 
          : req.headers['x-forwarded-host']) || '';
    const hostname = host.split(':')[0].toLowerCase();
    
    let store = null;
    
    // Priority 1: Check x-store-id header
    if (headerStoreId) {
      store = await Store.findById(headerStoreId);
      if (store) {
        resolvedStoreId = store._id.toString();
      }
    }
    
    // Priority 2: Check subdomain
    if (!store) {
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        const subdomain = parts[0].toLowerCase();
        store = await Store.findOne({ 
          subdomain: subdomain,
          status: 'active'
        });
        if (store) {
          resolvedStoreId = store._id.toString();
        }
      }
    }
    
    // Priority 3: Check custom domain
    if (!store) {
      store = await Store.findOne({
        $or: [
          { customDomain: hostname },
          { domain: hostname }
        ],
        status: 'active'
      });
      if (store) {
        resolvedStoreId = store._id.toString();
      }
    }
    
    // Priority 4: Use user's default store (if no store resolved)
    if (!store && user.defaultStoreId) {
      store = await Store.findById(user.defaultStoreId);
      if (store && store.status === 'active') {
        resolvedStoreId = store._id.toString();
      }
    }
    
    // Note: Store access verification is NOT done during login
    // Users should be able to log in regardless of store access
    // Store access will be verified when accessing store-specific resources
    // This allows users to log in even if they don't have a store yet or are switching stores
    if (store && resolvedStoreId) {
      console.log('[LOGIN] Store resolved during login:', { storeId: resolvedStoreId, storeName: store.name });
    } else {
      console.log('[LOGIN] No store resolved during login - user can still log in');
    }

    // Generate tokens with storeId
    const tokenId = generateTokenId();
    const accessToken = signAccessToken({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      storeId: resolvedStoreId || undefined, // Include storeId in JWT
    });
    const refreshToken = signRefreshToken(user._id.toString(), tokenId);

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      tokenId,
      revoked: false,
      expiresAt,
    });

    // Create session
    const { createSession } = await import('../utils/sessionUtils');
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await createSession({
      userId: user._id.toString(),
      refreshTokenId: tokenId,
      ipAddress: ipAddress.toString(),
      userAgent,
    });

    // Set refresh token as HTTP-only cookie (secure settings)
    const isProduction = process.env.NODE_ENV === 'production';
    // For cross-origin (Vercel frontend + separate backend), use 'none' with secure
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'none' | 'lax';
      path: string;
      maxAge: number;
    } = {
      httpOnly: true, // Not accessible via JavaScript
      secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
      path: '/', // Available to all paths
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
    console.log('[LOGIN] Refresh token cookie set:', { httpOnly: true, secure: isProduction, sameSite: cookieOptions.sameSite, path: '/' });

    // Also set cookies that Next.js middleware expects (so client-side route protection works).
    // Note: Middleware can read httpOnly cookies; JS cannot (safer).
    const accessTokenCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieOptions.sameSite,
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes (typical access token window)
    } as const;

    const userCookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieOptions.sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    } as const;

    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie(
      'user',
      JSON.stringify({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      }),
      userCookieOptions
    );

    // Generate and set CSRF token
    const { generateCsrfToken, setCsrfCookie } = await import('../utils/csrf');
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    // Audit log: Login success
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `User logged in successfully`,
      metadata: {
        email: user.email,
        role: user.role,
        storeId: resolvedStoreId || null,
      },
    });

    console.log('[LOGIN] Tokens issued successfully:', { userId: user._id.toString(), role: user.role, email: user.email });
    console.log('[LOGIN] User role from database:', user.role);
    
    // Clear brute force counters
    clearAttempts(clientIp, user.email);

    // Security log: login success
    await logSecurityEvent({
      req,
      eventType: 'LOGIN_SUCCESS',
      severity: 'low',
      metadata: {
        email: user.email,
        role: user.role,
        storeId: resolvedStoreId || null,
      },
    });

    // Return user data and access token
    const userResponse = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    
    console.log('[LOGIN] Returning user data:', userResponse);
    
    sendSuccess(
      res,
      {
        accessToken,
        user: userResponse,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Implements token rotation
 */
export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshTokenCookie = req.cookies?.refreshToken;

    if (!refreshTokenCookie) {
      // Most common cause in production: cross-site cookie not being sent (credentials / third‑party cookie policies)
      sendError(
        res,
        'Refresh token not provided (missing refreshToken cookie). If frontend and backend are on different domains, ensure requests use credentials and the browser allows cross-site cookies, or proxy API through the frontend domain.',
        401
      );
      return;
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenCookie);
    } catch (error) {
      // Can happen if token is expired OR the refresh secret env var is missing/mismatched.
      sendError(
        res,
        'Invalid or expired refresh token. Verify JWT_REFRESH_SECRET (or REFRESH_TOKEN_SECRET) is set correctly in the backend environment.',
        401
      );
      return;
    }

    // Check token in DB
    const tokenRecord = await RefreshToken.findOne({
      tokenId: decoded.tokenId,
      userId: decoded.userId,
      revoked: false,
    });

    if (!tokenRecord) {
      sendError(res, 'Refresh token not found or revoked', 401);
      return;
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expiresAt) {
      // Revoke expired token
      tokenRecord.revoked = true;
      await tokenRecord.save();
      sendError(res, 'Refresh token expired', 401);
      return;
    }

    // Check if session is revoked
    const { isSessionRevoked, touchSession } = await import('../utils/sessionUtils');
    const sessionRevoked = await isSessionRevoked(decoded.tokenId);
    if (sessionRevoked) {
      sendError(res, 'Session revoked', 401);
      return;
    }

    // Update session lastUsedAt
    await touchSession(decoded.tokenId);

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      sendError(res, 'User not found or inactive', 404);
      return;
    }

    // Token rotation: Revoke old token and create new one
    tokenRecord.revoked = true;
    await tokenRecord.save();

    // Revoke old session
    const { revokeSession, createSession } = await import('../utils/sessionUtils');
    await revokeSession(decoded.tokenId);

    // Generate new tokens
    const newTokenId = generateTokenId();
    const newAccessToken = signAccessToken({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken(user._id.toString(), newTokenId);

    // Store new refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      tokenId: newTokenId,
      revoked: false,
      expiresAt,
    });

    // Create new session for rotated token
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await createSession({
      userId: user._id.toString(),
      refreshTokenId: newTokenId,
      ipAddress: ipAddress.toString(),
      userAgent,
    });

    // Set new refresh token as HTTP-only cookie (secure settings)
    const isProduction = process.env.NODE_ENV === 'production';
    // For cross-origin (Vercel frontend + separate backend), use 'none' with secure
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'none' | 'lax';
      path: string;
      maxAge: number;
    } = {
      httpOnly: true, // Not accessible via JavaScript
      secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
      path: '/', // Available to all paths
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    // Rotate CSRF token on refresh
    const { generateCsrfToken: generateNewCsrfToken, setCsrfCookie: setNewCsrfCookie } = await import('../utils/csrf');
    const newCsrfToken = generateNewCsrfToken();
    setNewCsrfCookie(res, newCsrfToken);

    // Return new access token
    sendSuccess(
      res,
      {
        accessToken: newAccessToken,
      },
      'Token refreshed successfully'
    );

    // Audit log: Token refresh success
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'TOKEN_REFRESH',
      entityType: 'User',
      entityId: user._id.toString(),
      description: 'Access token refreshed',
      metadata: {
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout
 * Logout user and revoke refresh token
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshTokenCookie = req.cookies?.refreshToken;

    if (refreshTokenCookie) {
      try {
        // Verify token to get tokenId
        const decoded = verifyRefreshToken(refreshTokenCookie);
        
        // Revoke token in DB
        await RefreshToken.updateOne(
          { tokenId: decoded.tokenId },
          { revoked: true }
        );

        // Revoke session
        const { revokeSession } = await import('../utils/sessionUtils');
        await revokeSession(decoded.tokenId);
      } catch (error) {
        // Token invalid, but still clear cookie
        console.error('Error revoking token:', error);
      }
    }

    // Clear refresh token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax', // Must match the cookie setting used when setting it
      path: '/',
    });

    // Clear CSRF token cookie
    const { clearCsrfCookie } = await import('../utils/csrf');
    clearCsrfCookie(res);

    // Audit log: Logout
    if (refreshTokenCookie) {
      try {
        const decoded = verifyRefreshToken(refreshTokenCookie);
        const { logAudit } = await import('../utils/auditLogger');
        const user = await User.findById(decoded.userId);
        if (user) {
          await logAudit({
            req,
            actorId: user._id.toString(),
            actorRole: user.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system',
            action: 'LOGOUT',
            entityType: 'User',
            entityId: user._id.toString(),
            description: `User logged out`,
            metadata: {
              email: user.email,
            },
          });
        }
      } catch (error) {
        // Ignore - token might be invalid
      }
    }

    sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/magic-link
 * Generate and send magic link for passwordless login
 */
export const sendMagicLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[MAGIC LINK] Request received:', { email: req.body.email });
    
    // Ensure MongoDB connection before database operations
    const mongoose = (await import('mongoose')).default;
    const connectionState = mongoose.connection.readyState;
    if (connectionState !== 1) {
      console.log('[MAGIC LINK] MongoDB not connected, attempting connection...');
      const { connectDB } = await import('../config/db');
      try {
        await connectDB();
        // Wait a moment for connection to stabilize
        let attempts = 0;
        while (mongoose.connection.readyState !== 1 && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (mongoose.connection.readyState !== 1) {
          throw new Error('MongoDB connection failed - readyState: ' + mongoose.connection.readyState);
        }
        console.log('[MAGIC LINK] MongoDB connected successfully');
      } catch (dbError: any) {
        console.error('[MAGIC LINK] Database connection error:', dbError?.message);
        sendError(res, 'Database connection failed. Please verify MONGODB_URI is set in Vercel environment variables and MongoDB Atlas Network Access allows all IPs (0.0.0.0/0).', 503);
        return;
      }
    }
    
    // Validate request body
    const emailSchema = z.object({
      email: z.string().email('Invalid email address'),
    });
    
    const validatedData = emailSchema.parse(req.body);
    const { email } = validatedData;

    // Find user by email
    let user;
    try {
      user = await User.findOne({ email: email.toLowerCase() });
    } catch (dbError: any) {
      console.error('[MAGIC LINK] Error finding user:', dbError?.message);
      if (dbError?.message?.includes('buffering') || dbError?.message?.includes('timeout')) {
        sendError(res, 'Database operation timed out. Please verify MongoDB connection is working and try again.', 503);
        return;
      }
      throw dbError; // Re-throw other errors
    }
    
    if (!user) {
      // Don't reveal if user exists (security best practice)
      console.log('[MAGIC LINK] User not found (silent fail):', email);
      sendSuccess(res, null, 'If an account exists with this email, a magic link has been sent.');
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('[MAGIC LINK] User inactive:', email);
      sendSuccess(res, null, 'If an account exists with this email, a magic link has been sent.');
      return;
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log('[MAGIC LINK] Email not verified:', email);
      sendError(res, 'Please verify your email address first', 403);
      return;
    }

    // Generate magic link token
    const rawToken = generateMagicLinkToken();
    const tokenHash = hashMagicLinkToken(rawToken);

    // Set expiration (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Invalidate any existing unused magic links for this email
    try {
      await MagicLink.updateMany(
        { email: email.toLowerCase(), used: false },
        { used: true }
      );
    } catch (dbError: any) {
      console.error('[MAGIC LINK] Error invalidating existing magic links:', dbError?.message);
      // Continue anyway - this is not critical
    }

    // Create new magic link record
    const magicLink = new MagicLink({
      email: email.toLowerCase(),
      tokenHash,
      expiresAt,
      used: false,
    });

    await magicLink.save();

    // Build magic login URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const magicLoginUrl = `${frontendUrl}/magic-login?token=${rawToken}`;

    // Send email using Nodemailer
    try {
      const { sendMail } = await import('../utils/mailer');
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Magic Login Link</h2>
          <p>Click the button below to login to your account. No password needed!</p>
          <p style="margin: 20px 0;">
            <a href="${magicLoginUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
              Login to Your Account
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link expires in 15 minutes and can only be used once.<br>
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px; word-break: break-all;">
            <a href="${magicLoginUrl}" style="color: #007bff;">${magicLoginUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            If you didn't request this login link, please ignore this email.<br>
            Your account remains secure.
          </p>
        </div>
      `;

      await sendMail(
        email,
        'Your Magic Login Link',
        emailHtml
      );
      
      console.log('[MAGIC LINK] Magic link email sent successfully to:', email);
    } catch (emailError) {
      // Log error but don't fail the request (prevent email enumeration)
      console.error('[MAGIC LINK] Failed to send magic link email:', emailError);
      // Fallback: log to console for development
      if (process.env.NODE_ENV !== 'production') {
        console.log('========================================');
        console.log('MAGIC LINK EMAIL (Email send failed, showing here for dev)');
        console.log('========================================');
        console.log(`To: ${email}`);
        console.log(`Subject: Your Magic Login Link`);
        console.log(`\nClick the link below to login:\n${magicLoginUrl}`);
        console.log(`\nThis link expires in 15 minutes and can only be used once.`);
        console.log('========================================');
      }
      // Continue execution - still return success to prevent enumeration
    }

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'MAGIC_LINK_SENT',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Magic link sent to ${email}`,
      metadata: {
        email: email,
      },
    });

    console.log('[MAGIC LINK] Magic link sent successfully:', { email, expiresAt });
    
    sendSuccess(res, null, 'If an account exists with this email, a magic link has been sent.');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/magic-login
 * Validate magic link token and auto-login user
 */
export const magicLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[MAGIC LOGIN] Request received');
    
    const token = req.query.token as string;
    
    if (!token) {
      sendError(res, 'Magic link token is required', 400);
      return;
    }

    // Hash the token to look it up
    const tokenHash = hashMagicLinkToken(token);

    // Find magic link record
    const magicLink = await MagicLink.findOne({
      tokenHash,
      used: false,
    });

    if (!magicLink) {
      console.log('[MAGIC LOGIN] Invalid or used token');
      sendError(res, 'Invalid or expired magic link', 401);
      return;
    }

    // Check if token is expired
    if (new Date() > magicLink.expiresAt) {
      console.log('[MAGIC LOGIN] Token expired:', magicLink.expiresAt);
      // Mark as used
      magicLink.used = true;
      await magicLink.save();
      sendError(res, 'Magic link has expired. Please request a new one.', 401);
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: magicLink.email });

    if (!user) {
      console.log('[MAGIC LOGIN] User not found for email:', magicLink.email);
      magicLink.used = true;
      await magicLink.save();
      sendError(res, 'User not found', 404);
      return;
    }

    // Align magic-link login with password login behavior:
    // - In prod, resellers can self-login; auto-approve/activate legacy pending/inactive resellers
    // - Admin/supplier still require approval/active state (unless in dev)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isAdmin = user.role === 'admin';
    const isReseller = user.role === 'reseller';

    if (!isAdmin && !isDevelopment && user.approvalStatus !== 'approved') {
      if (isReseller) {
        user.approvalStatus = 'approved';
        user.approvedAt = new Date();
        user.isActive = true;
        await user.save();
      } else {
        magicLink.used = true;
        await magicLink.save();
        sendError(res, 'Account pending admin approval', 403);
        return;
      }
    }

    if (!isDevelopment && isReseller && user.approvalStatus === 'approved' && !user.isBlocked && !user.isActive) {
      user.isActive = true;
      await user.save();
    }

    // Check if user is blocked/active
    if (user.isBlocked) {
      console.log('[MAGIC LOGIN] User blocked:', user.email);
      magicLink.used = true;
      await magicLink.save();
      sendError(res, 'Account blocked by admin', 403);
      return;
    }
    if (!user.isActive) {
      console.log('[MAGIC LOGIN] User inactive:', user.email);
      magicLink.used = true;
      await magicLink.save();
      sendError(res, 'Account is inactive', 403);
      return;
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log('[MAGIC LOGIN] Email not verified:', user.email);
      magicLink.used = true;
      await magicLink.save();
      sendError(res, 'Please verify your email address first', 403);
      return;
    }

    // Mark magic link as used
    magicLink.used = true;
    await magicLink.save();

    // Generate tokens (same as regular login)
    const tokenId = generateTokenId();
    const accessToken = signAccessToken({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user._id.toString(), tokenId);

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      tokenId,
      revoked: false,
      expiresAt,
    });

    // Create session
    const { createSession } = await import('../utils/sessionUtils');
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await createSession({
      userId: user._id.toString(),
      refreshTokenId: tokenId,
      ipAddress: ipAddress.toString(),
      userAgent,
    });

    // Set refresh token as HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    // For cross-origin (Vercel frontend + separate backend), use 'none' with secure
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'none' | 'lax';
      path: string;
      maxAge: number;
    } = {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
    console.log('[MAGIC LOGIN] Refresh token cookie set:', { httpOnly: true, secure: isProduction, sameSite: cookieOptions.sameSite });

    // Generate and set CSRF token
    const { generateCsrfToken, setCsrfCookie } = await import('../utils/csrf');
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'MAGIC_LINK_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `User logged in via magic link`,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    console.log('[MAGIC LOGIN] Login successful:', { userId: user._id.toString(), role: user.role });

    // Return user data and access token
    sendSuccess(
      res,
      {
        accessToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/otp/send
 * Generate and send OTP to phone number
 */
export const sendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[OTP SEND] Request received:', { phone: req.body.phone });
    
    // Validate request body
    const phoneSchema = z.object({
      phone: z.string().min(10, 'Phone number is required'),
    });
    
    const validatedData = phoneSchema.parse(req.body);
    let { phone } = validatedData;

    // Normalize and validate phone number
    phone = normalizePhoneNumber(phone);
    
    if (!isValidPhoneNumber(phone)) {
      sendError(res, 'Invalid phone number format', 400);
      return;
    }

    // Generate OTP
    const rawOTP = generateOTP();
    const otpHash = hashOTP(rawOTP);

    // Set expiration (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Ensure MongoDB connection before database operations
    const mongoose = (await import('mongoose')).default;
    const connectionState = mongoose.connection.readyState;
    if (connectionState !== 1) {
      console.log('[OTP SEND] MongoDB not connected, attempting connection...');
      const { connectDB } = await import('../config/db');
      try {
        await connectDB();
        // Wait a moment for connection to stabilize
        let attempts = 0;
        while (mongoose.connection.readyState !== 1 && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (mongoose.connection.readyState !== 1) {
          throw new Error('MongoDB connection failed - readyState: ' + mongoose.connection.readyState);
        }
        console.log('[OTP SEND] MongoDB connected successfully');
      } catch (dbError: any) {
        console.error('[OTP SEND] Database connection error:', dbError?.message);
        sendError(res, 'Database connection failed. Please verify MONGODB_URI is set in Vercel environment variables and MongoDB Atlas Network Access allows all IPs (0.0.0.0/0).', 503);
        return;
      }
    }

    // Invalidate any existing unused OTPs for this phone
    try {
      await OTP.updateMany(
        { phone, verified: false },
        { verified: true }
      );
    } catch (dbError: any) {
      console.error('[OTP SEND] Error invalidating existing OTPs:', dbError?.message);
      // Continue anyway - this is not critical
    }

    // Create new OTP record
    const otpRecord = new OTP({
      phone,
      otpHash,
      expiresAt,
      attempts: 0,
      verified: false,
    });

    try {
      await otpRecord.save();
    } catch (dbError: any) {
      console.error('[OTP SEND] Error saving OTP:', dbError?.message);
      if (dbError?.message?.includes('buffering') || dbError?.message?.includes('timeout')) {
        sendError(res, 'Database operation timed out. Please verify MongoDB connection is working and try again.', 503);
        return;
      }
      throw dbError; // Re-throw other errors
    }

    // Send OTP via SMS using Fast2SMS
    let smsSent = false;
    try {
      await sendOTPSMS(phone, rawOTP);
      smsSent = true;
      console.log('[OTP SEND] OTP sent via SMS to:', phone);
    } catch (smsError) {
      // Log error but don't fail the request (prevent enumeration)
      console.error('[OTP SEND] Failed to send OTP SMS:', smsError);
      // Fallback: log to console for development
      if (process.env.NODE_ENV !== 'production') {
        console.log('========================================');
        console.log('OTP CODE (SMS send failed, showing here for dev)');
        console.log('========================================');
        console.log(`Phone: ${phone}`);
        console.log(`OTP: ${rawOTP}`);
        console.log(`\nYour verification code is: ${rawOTP}`);
        console.log(`This code expires in 5 minutes.`);
        console.log('========================================');
        console.log('\n⚠️  To send OTP via SMS, set FAST2SMS_API_KEY in .env');
      }
      // In production, still return success to prevent enumeration
    }

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorRole: 'reseller', // No user found yet
      action: 'OTP_SENT',
      entityType: 'User',
      description: `OTP sent to ${phone}`,
      metadata: {
        phone: phone,
      },
    });

    console.log('[OTP SEND] OTP sent successfully:', { phone, expiresAt });
    
    // In local/dev, optionally return the OTP so you can test without an SMS provider.
    // Enable by setting: DEV_OTP_IN_RESPONSE=true
    const devOtpEnabled = process.env.DEV_OTP_IN_RESPONSE === 'true';
    const isProduction = process.env.NODE_ENV === 'production';

    // Don't reveal if user exists (security best practice)
    sendSuccess(
      res,
      !isProduction && devOtpEnabled && !smsSent ? { devOtp: rawOTP } : null,
      'If an account exists with this phone number, an OTP has been sent.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/otp/verify
 * Verify OTP and login or auto-create user
 */
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('[OTP VERIFY] Request received');
    
    // Validate request body
    const verifySchema = z.object({
      phone: z.string().min(10, 'Phone number is required'),
      otp: z.string().length(6, 'OTP must be 6 digits'),
    });
    
    const validatedData = verifySchema.parse(req.body);
    let { phone, otp } = validatedData;

    // Normalize phone number
    phone = normalizePhoneNumber(phone);
    
    if (!isValidPhoneNumber(phone)) {
      sendError(res, 'Invalid phone number format', 400);
      return;
    }

    // Ensure MongoDB connection before database operations
    const mongoose = (await import('mongoose')).default;
    const connectionState = mongoose.connection.readyState;
    if (connectionState !== 1) {
      console.log('[OTP VERIFY] MongoDB not connected, attempting connection...');
      const { connectDB } = await import('../config/db');
      try {
        await connectDB();
        // Wait a moment for connection to stabilize
        let attempts = 0;
        while (mongoose.connection.readyState !== 1 && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (mongoose.connection.readyState !== 1) {
          throw new Error('MongoDB connection failed - readyState: ' + mongoose.connection.readyState);
        }
        console.log('[OTP VERIFY] MongoDB connected successfully');
      } catch (dbError: any) {
        console.error('[OTP VERIFY] Database connection error:', dbError?.message);
        sendError(res, 'Database connection failed. Please verify MONGODB_URI is set in Vercel environment variables and MongoDB Atlas Network Access allows all IPs (0.0.0.0/0).', 503);
        return;
      }
    }

    // Hash the OTP to look it up
    const otpHash = hashOTP(otp);

    // Find OTP record
    let otpRecord;
    try {
      otpRecord = await OTP.findOne({
        phone,
        otpHash,
        verified: false,
      });
    } catch (dbError: any) {
      console.error('[OTP VERIFY] Error finding OTP:', dbError?.message);
      if (dbError?.message?.includes('buffering') || dbError?.message?.includes('timeout')) {
        sendError(res, 'Database operation timed out. Please verify MongoDB connection is working and try again.', 503);
        return;
      }
      throw dbError; // Re-throw other errors
    }

    if (!otpRecord) {
      console.log('[OTP VERIFY] Invalid OTP');
      
      // Increment attempts for this phone (if record exists with wrong OTP)
      try {
        await OTP.updateMany(
          { phone, verified: false },
          { $inc: { attempts: 1 } }
        );
      } catch (dbError: any) {
        console.error('[OTP VERIFY] Error updating attempts:', dbError?.message);
        // Continue anyway - this is not critical
      }
      
      sendError(res, 'Invalid or expired OTP', 401);
      return;
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      console.log('[OTP VERIFY] OTP expired:', otpRecord.expiresAt);
      otpRecord.verified = true;
      await otpRecord.save();
      sendError(res, 'OTP has expired. Please request a new one.', 401);
      return;
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= 3) {
      console.log('[OTP VERIFY] Max attempts exceeded:', otpRecord.attempts);
      otpRecord.verified = true;
      await otpRecord.save();
      sendError(res, 'Maximum verification attempts exceeded. Please request a new OTP.', 401);
      return;
    }

    // Mark OTP as verified
    otpRecord.verified = true;
    await otpRecord.save();

    // Find or create user by phone
    let user = await User.findOne({ phone });

    if (!user) {
      // Auto-create user if doesn't exist
      console.log('[OTP VERIFY] User not found, creating new user');
      
      // Generate a random password (user can set it later)
      const randomPassword = generateOTP() + generateOTP(); // 12 character random password
      const passwordHash = await hashPassword(randomPassword);

      // Create user with phone number
      user = new User({
        name: `User ${phone.slice(-4)}`, // Temporary name
        email: `${phone.replace(/[^0-9]/g, '')}@phone.temp`, // Temporary email
        phone,
        passwordHash,
        role: 'reseller', // Default role
        isActive: true,
        isEmailVerified: false, // Phone verified, but email not
      });

      await user.save();
      console.log('[OTP VERIFY] New user created:', { userId: user._id.toString(), phone });
    } else {
      // Align OTP login with password login behavior:
      // - Resellers are self-service; auto-approve/activate legacy pending/inactive resellers
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const isReseller = user.role === 'reseller';
      const isAdmin = user.role === 'admin';

      if (!isDevelopment && !isAdmin && user.approvalStatus !== 'approved') {
        if (isReseller) {
          user.approvalStatus = 'approved';
          user.approvedAt = new Date();
          user.isActive = true;
          await user.save();
        } else {
          sendError(res, 'Account pending admin approval', 403);
          return;
        }
      }

      if (!isDevelopment && isReseller && user.approvalStatus === 'approved' && !user.isBlocked && !user.isActive) {
        user.isActive = true;
        await user.save();
      }

      if (user.isBlocked) {
        sendError(res, 'Account blocked by admin', 403);
        return;
      }
      if (!user.isActive) {
        console.log('[OTP VERIFY] User inactive:', phone);
        sendError(res, 'Account is inactive', 403);
        return;
      }
    }

    // Generate tokens (same as regular login)
    const tokenId = generateTokenId();
    const accessToken = signAccessToken({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user._id.toString(), tokenId);

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await RefreshToken.create({
      userId: user._id,
      tokenId,
      revoked: false,
      expiresAt,
    });

    // Create session
    const { createSession } = await import('../utils/sessionUtils');
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await createSession({
      userId: user._id.toString(),
      refreshTokenId: tokenId,
      ipAddress: ipAddress.toString(),
      userAgent,
    });

    // Set refresh token as HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    // For cross-origin (Vercel frontend + separate backend), use 'none' with secure
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'none' | 'lax';
      path: string;
      maxAge: number;
    } = {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production (required for sameSite: 'none')
      sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
    console.log('[OTP VERIFY] Refresh token cookie set:', { httpOnly: true, secure: isProduction, sameSite: cookieOptions.sameSite });

    // Generate and set CSRF token
    const { generateCsrfToken, setCsrfCookie } = await import('../utils/csrf');
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    // Audit log
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'OTP_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `User logged in via OTP`,
      metadata: {
        phone: phone,
        role: user.role,
        isNewUser: !user.createdAt || (Date.now() - user.createdAt.getTime()) < 60000, // Created within last minute
      },
    });

    console.log('[OTP VERIFY] Login successful:', { userId: user._id.toString(), role: user.role });

    // Return user data and access token
    sendSuccess(
      res,
      {
        accessToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

