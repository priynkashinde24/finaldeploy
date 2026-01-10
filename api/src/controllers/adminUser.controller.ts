import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { hashPassword } from '../utils/password';
import { z } from 'zod';

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['supplier', 'reseller']), // Admin cannot create admin via this endpoint
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'supplier', 'reseller', 'affiliate']),
});

/**
 * POST /admin/users
 * Create a new user (supplier or reseller) by admin
 */
export const createUserByAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createUserSchema.parse(req.body);
    const { name, email, role, password } = validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Get current admin user
    const currentUser = req.user;

    // Create new user (admin-created users are approved by default)
    const user = new User({
      name,
      email,
      passwordHash,
      role,
      isActive: true,
      approvalStatus: 'approved', // Admin-created users are approved immediately
      approvedAt: new Date(),
      approvedBy: currentUser?.id || null,
      rejectionReason: null,
    });

    await user.save();

    // Audit log: User created by admin
    const { logAudit } = await import('../utils/auditLogger');
    if (currentUser) {
      await logAudit({
        actorId: currentUser.id,
        actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Admin created user: ${user.email} (${user.role})`,
        req,
        metadata: {
          createdUserEmail: user.email,
          createdUserRole: user.role,
          createdUserName: user.name,
        },
      });
    }

    // Return created user (no password)
    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      'User created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/users
 * List all users with filters and pagination
 */
export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, status, page = '1', limit = '20' } = req.query;

    // Build filter
    const filter: any = {};
    
    if (role && (role === 'admin' || role === 'supplier' || role === 'reseller')) {
      filter.role = role;
    }

    if (status !== undefined) {
      if (status === 'active') {
        filter.isActive = true;
      } else if (status === 'inactive') {
        filter.isActive = false;
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch users
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash') // Exclude password hash
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Format response
    const formattedUsers = users.map((user: any) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified || false,
      isBlocked: user.isBlocked || false,
      approvedAt: user.approvedAt || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    sendSuccess(
      res,
      {
        users: formattedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Users fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/status
 * Update user status (activate/deactivate)
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateStatusSchema.parse(req.body);
    const { isActive } = validatedData;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Prevent admin from deactivating themselves
    if (id === currentUser.id && !isActive) {
      sendError(res, 'You cannot deactivate your own account', 400);
      return;
    }

    // Find and update user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const previousStatus = user.isActive;
    user.isActive = isActive;
    await user.save();

    // Audit log: User status changed
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Admin ${isActive ? 'enabled' : 'disabled'} user: ${user.email}`,
      req,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        previousStatus,
        newStatus: isActive,
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
      `User ${isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/reset-password
 * Reset user password
 */
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = resetPasswordSchema.parse(req.body);
    const { newPassword } = validatedData;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    user.passwordHash = passwordHash;
    await user.save();

    // Audit log: Password reset by admin
    const { logAudit } = await import('../utils/auditLogger');
    const currentUser = req.user;
    if (currentUser) {
      await logAudit({
        actorId: currentUser.id,
        actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
        action: 'PASSWORD_RESET_BY_ADMIN',
        entityType: 'User',
        entityId: user._id.toString(),
        description: `Admin reset password for user: ${user.email}`,
        req,
        metadata: {
          targetUserEmail: user.email,
          targetUserRole: user.role,
        },
      });
    }

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          email: user.email,
        },
      },
      'Password reset successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/unlock
 * Unlock user account (Admin only)
 */
export const unlockUserAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Check if account is actually locked
    if (!user.lockUntil || user.lockUntil <= new Date()) {
      sendError(res, 'Account is not locked', 400);
      return;
    }

    // Unlock account
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
    await user.save();

    // Audit log: Account unlocked by admin
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'ACCOUNT_UNLOCKED_BY_ADMIN',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Admin unlocked account for user: ${user.email}`,
      req,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          failedLoginAttempts: user.failedLoginAttempts,
          lockUntil: user.lockUntil,
        },
      },
      'Account unlocked successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/approve
 * Approve a user (set isActive = true, approvedAt = now, clear isBlocked)
 */
export const approveUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Prevent admin from approving themselves (they're already approved)
    if (id === currentUser.id) {
      sendError(res, 'You cannot approve your own account', 400);
      return;
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Check if already approved
    if (user.isActive && user.approvedAt) {
      sendError(res, 'User is already approved', 400);
      return;
    }

    // Approve user
    user.isActive = true;
    user.approvedAt = new Date();
    user.isBlocked = false;
    await user.save();

    // Audit log: User approved
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'USER_APPROVED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Admin approved user: ${user.email} (${user.role})`,
      req,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        approvedAt: user.approvedAt.toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          approvedAt: user.approvedAt,
        },
      },
      'User approved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/block
 * Block a user (set isBlocked = true, isActive = false)
 */
export const blockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Prevent admin from blocking themselves
    if (id === currentUser.id) {
      sendError(res, 'You cannot block your own account', 400);
      return;
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Check if already blocked
    if (user.isBlocked) {
      sendError(res, 'User is already blocked', 400);
      return;
    }

    // Block user
    user.isBlocked = true;
    user.isActive = false;
    await user.save();

    // Audit log: User blocked
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'USER_BLOCKED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Admin blocked user: ${user.email} (${user.role})`,
      req,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        blockedAt: new Date().toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          approvedAt: user.approvedAt,
        },
      },
      'User blocked successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/role
 * Update user role (Admin only)
 */
export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateRoleSchema.parse(req.body);
    const { role: newRole } = validatedData;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Prevent admin from changing their own role
    if (id === currentUser.id) {
      sendError(res, 'You cannot change your own role', 400);
      return;
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const previousRole = user.role;

    // Prevent changing to admin role (admins should be created differently)
    if (newRole === 'admin' && previousRole !== 'admin') {
      sendError(res, 'Cannot assign admin role via this endpoint', 400);
      return;
    }

    // Update role
    user.role = newRole;
    await user.save();

    // Audit log: Role changed
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller' | 'affiliate' | 'system',
      action: 'USER_ROLE_UPDATED',
      entityType: 'User',
      entityId: user._id.toString(),
      description: `Admin changed user role from ${previousRole} to ${newRole}: ${user.email}`,
      req,
      metadata: {
        targetUserEmail: user.email,
        previousRole,
        newRole,
      },
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
      `User role updated from ${previousRole} to ${newRole} successfully`
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
 * DELETE /admin/users/:id
 * Permanently delete a user
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Prevent admin from deleting themselves
    if (id === currentUser.id) {
      sendError(res, 'You cannot delete your own account', 400);
      return;
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Store user info for audit log before deletion
    const userEmail = user.email;
    const userRole = user.role;
    const userId = user._id.toString();

    // Delete user
    await User.findByIdAndDelete(id);

    // Audit log: User deleted
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: userId,
      description: `Admin deleted user: ${userEmail} (${userRole})`,
      req,
      metadata: {
        deletedUserEmail: userEmail,
        deletedUserRole: userRole,
        deletedAt: new Date().toISOString(),
      },
    });

    sendSuccess(
      res,
      {
        deletedUserId: userId,
        deletedUserEmail: userEmail,
      },
      'User deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

