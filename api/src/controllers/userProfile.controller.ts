import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { hashPassword, comparePassword } from '../utils/password';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger';

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters').optional(),
  phone: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

/**
 * GET /user/profile
 * Get current user's profile
 */
export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const user = await User.findById(currentUser.id).select('-passwordHash').lean();

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || user.phoneNumber || null,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
          approvalStatus: user.approvalStatus,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      'Profile retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /user/profile
 * Update current user's profile
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const validatedData = updateProfileSchema.parse(req.body);

    const user = await User.findById(currentUser.id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Update fields
    if (validatedData.name !== undefined) {
      user.name = validatedData.name;
    }
    if (validatedData.phone !== undefined) {
      user.phone = validatedData.phone || undefined;
    }
    if (validatedData.phoneNumber !== undefined) {
      user.phoneNumber = validatedData.phoneNumber || undefined;
    }

    await user.save();

    // Audit log
    await logAudit({
      req,
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: 'User updated their profile',
      metadata: {
        updatedFields: Object.keys(validatedData),
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || user.phoneNumber || null,
          role: user.role,
        },
      },
      'Profile updated successfully'
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

/**
 * PATCH /user/password
 * Change current user's password
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const validatedData = changePasswordSchema.parse(req.body);
    const { currentPassword, newPassword } = validatedData;

    const user = await User.findById(currentUser.id).select('+passwordHash');
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      sendError(res, 'Current password is incorrect', 400);
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    await user.save();

    // Audit log
    await logAudit({
      req,
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: 'User changed their password',
    });

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0].message, 400);
      return;
    }
    next(error);
  }
};

