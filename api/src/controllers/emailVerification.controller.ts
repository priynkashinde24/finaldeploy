import { Request, Response, NextFunction } from 'express';
import { EmailVerification } from '../models/EmailVerification';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { generateEmailVerificationToken, hashEmailVerificationToken } from '../utils/emailVerificationToken';

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // Max 3 requests per window

/**
 * Check rate limit for send verification requests
 */
const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
};

/**
 * POST /auth/send-verification
 * Send email verification link (Authenticated or Public with email)
 */
export const sendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let userId: string;
    let userEmail: string;

    // Check if authenticated or using email
    const currentUser = req.user;
    if (currentUser) {
      // Authenticated flow
      userId = currentUser.id;
      const user = await User.findById(userId);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }
      userEmail = user.email;

      // Only send verification if email is not verified
      if (user.isEmailVerified) {
        sendError(res, 'Email is already verified', 400);
        return;
      }

      // Rate limiting
      if (!checkRateLimit(userId)) {
        sendError(res, 'Too many requests. Please try again later.', 429);
        return;
      }
    } else {
      // Public flow - require email in body
      const { email } = req.body;
      if (!email) {
        sendError(res, 'Email is required', 400);
        return;
      }

      // Find user by email
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        // Don't reveal if user exists (security)
        sendSuccess(res, null, 'If account exists, verification email sent.');
        return;
      }

      // Only send verification if email is not verified
      if (user.isEmailVerified) {
        sendError(res, 'Email is already verified', 400);
        return;
      }

      userId = user._id.toString();
      userEmail = user.email;

      // Rate limiting by email
      if (!checkRateLimit(email.toLowerCase())) {
        sendSuccess(res, null, 'If account exists, verification email sent.');
        return;
      }
    }

    // Generate verification token
    const rawToken = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(rawToken);

    // Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Invalidate any existing unused verification tokens for this user
    await EmailVerification.updateMany(
      { userId: user._id, used: false },
      { used: true }
    );

    // Create new email verification record
    const emailVerification = new EmailVerification({
      userId: user._id,
      tokenHash,
      expiresAt,
      used: false,
    });

    await emailVerification.save();

    // Build verification URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    // Send email (stub - console.log for now)
    console.log('========================================');
    console.log('EMAIL VERIFICATION EMAIL (STUB)');
    console.log('========================================');
    console.log(`To: ${userEmail}`);
    console.log(`Subject: Verify Your Email Address`);
    console.log(`\nClick the link below to verify your email address:\n${verificationUrl}`);
    console.log(`\nThis link expires in 24 hours.`);
    console.log(`If you didn't create this account, please ignore this email.`);
    console.log('========================================');

    // Return success
    sendSuccess(res, null, 'Verification email sent successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /auth/verify-email
 * Verify email using token (Public)
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      sendError(res, 'Token is required', 400);
      return;
    }

    // Hash the token
    const tokenHash = hashEmailVerificationToken(token);

    // Find email verification record
    const emailVerification = await EmailVerification.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!emailVerification) {
      sendError(res, 'Invalid or expired verification token', 400);
      return;
    }

    // Find user
    const user = await User.findById(emailVerification.userId);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Check if already verified
    if (user.isEmailVerified) {
      // Mark token as used anyway
      emailVerification.used = true;
      await emailVerification.save();
      sendSuccess(res, null, 'Email is already verified');
      return;
    }

    // Verify email
    user.isEmailVerified = true;
    await user.save();

    // Mark verification token as used
    emailVerification.used = true;
    await emailVerification.save();

    // Audit log: Email verified
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Email verified successfully`,
      req,
      metadata: {
        email: user.email,
      },
    });

    // Return success
    sendSuccess(res, null, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

