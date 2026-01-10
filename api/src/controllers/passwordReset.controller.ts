import { Request, Response, NextFunction } from 'express';
import { PasswordReset } from '../models/PasswordReset';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { hashPassword } from '../utils/password';
import { generateResetToken, hashResetToken } from '../utils/resetToken';
import { sendMail } from '../utils/mailer';
import { z } from 'zod';

// Validation schemas
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // Max 3 requests per window

/**
 * Check rate limit for forgot password requests
 */
const checkRateLimit = (email: string): boolean => {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
};

/**
 * POST /auth/forgot-password
 * Request password reset (Public)
 * Security: Always returns success to prevent email enumeration
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = forgotPasswordSchema.parse(req.body);
    const { email } = validatedData;

    // Rate limiting
    if (!checkRateLimit(email)) {
      // Still return success to prevent enumeration
      sendSuccess(res, null, 'If account exists, reset link sent.');
      return;
    }

    // Find user (only active users can reset password)
    const user = await User.findOne({ email, isActive: true });

    if (user) {
      // Generate reset token
      const rawToken = generateResetToken();
      const tokenHash = hashResetToken(rawToken);

      // Set expiration (30 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      // Invalidate any existing unused reset tokens for this user
      await PasswordReset.updateMany(
        { userId: user._id, used: false },
        { used: true }
      );

      // Create new password reset record
      const passwordReset = new PasswordReset({
        userId: user._id,
        tokenHash,
        expiresAt,
        used: false,
      });

      await passwordReset.save();

      // Build reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      // Send email using Nodemailer
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>You requested to reset your password. Click the link below to proceed:</p>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link expires in 30 minutes.<br>
              If you didn't request this, please ignore this email.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #007bff; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        `;

        await sendMail(
          user.email,
          'Reset Your Password',
          emailHtml
        );
      } catch (emailError) {
        // Log error but don't fail the request (prevent email enumeration)
        console.error('Failed to send password reset email:', emailError);
        // Continue execution - still return success to prevent enumeration
      }

      // Audit log: Password reset request
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUEST',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Password reset requested`,
        metadata: {
          email: user.email,
        },
      });

      // Security log
      const { logSecurityEvent } = await import('../utils/securityLogger');
      await logSecurityEvent({
        req,
        eventType: 'PASSWORD_RESET_REQUEST',
        severity: 'medium',
        metadata: { email: user.email },
      });
    }

    // Always return success (prevent email enumeration)
    sendSuccess(res, null, 'If account exists, reset link sent.');
  } catch (error) {
    // Even on error, return success to prevent enumeration
    sendSuccess(res, null, 'If account exists, reset link sent.');
  }
};

/**
 * GET /auth/reset-password/validate
 * Validate a reset token (Public)
 */
export const validateResetToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      sendError(res, 'Token is required', 400);
      return;
    }

    // Hash the token
    const tokenHash = hashResetToken(token);

    // Find password reset record
    const passwordReset = await PasswordReset.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!passwordReset) {
      sendError(res, 'Invalid or expired reset token', 400);
      return;
    }

    // Check if user still exists and is active
    const user = await User.findById(passwordReset.userId);
    if (!user || !user.isActive) {
      sendError(res, 'Invalid reset token', 400);
      return;
    }

    // Return success
    sendSuccess(res, { valid: true }, 'Reset token is valid');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/reset-password
 * Reset password using token (Public)
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = resetPasswordSchema.parse(req.body);
    const { token, newPassword } = validatedData;

    // Hash the token
    const tokenHash = hashResetToken(token);

    // Find and validate password reset record
    const passwordReset = await PasswordReset.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!passwordReset) {
      sendError(res, 'Invalid or expired reset token', 400);
      return;
    }

    // Find user
    const user = await User.findById(passwordReset.userId);
    if (!user || !user.isActive) {
      sendError(res, 'User not found or inactive', 404);
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user's password
    user.passwordHash = passwordHash;
    await user.save();

    // Mark reset token as used
    passwordReset.used = true;
    await passwordReset.save();

    // Invalidate all refresh tokens for this user (force re-login)
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { revoked: true }
    );

    // Revoke all sessions for this user
    const { revokeAllSessions } = await import('../utils/sessionUtils');
    await revokeAllSessions(user._id.toString());

    // Audit log: Password reset success
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      req,
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'PASSWORD_RESET_SUCCESS',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Password reset completed`,
      metadata: {
        email: user.email,
      },
    });

    // Return success
    sendSuccess(res, null, 'Password reset successfully. Please login with your new password.');
  } catch (error) {
    next(error);
  }
};

