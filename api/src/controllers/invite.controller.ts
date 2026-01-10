import { Request, Response, NextFunction } from 'express';
import { Invite } from '../models/Invite';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { hashPassword } from '../utils/password';
import { generateInviteToken, hashInviteToken } from '../utils/inviteToken';
import { z } from 'zod';

// Validation schemas
const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['supplier', 'reseller']),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /admin/invites
 * Create an invite for a user (Admin only)
 */
export const createInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createInviteSchema.parse(req.body);
    const { email, role } = validatedData;

    // Get current admin user
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Check if there's a pending invite for this email
    const existingInvite = await Invite.findOne({
      email,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      sendError(res, 'An active invite already exists for this email', 400);
      return;
    }

    // Generate invite token
    const rawToken = generateInviteToken();
    const tokenHash = hashInviteToken(rawToken);

    // Set expiration (48 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Create invite
    const invite = new Invite({
      email,
      role,
      tokenHash,
      expiresAt,
      used: false,
      createdBy: currentUser.id,
    });

    await invite.save();

    // Build invite URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${frontendUrl}/invite/accept?token=${rawToken}`;

    // Send email (stub - console.log for now)
    console.log('========================================');
    console.log('INVITE EMAIL (STUB)');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Subject: You're invited to join Revocart as a ${role}`);
    console.log(`\nClick the link below to accept your invitation:\n${inviteUrl}`);
    console.log(`\nThis link expires in 48 hours.`);
    console.log('========================================');

    // Audit log: Invite sent
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'INVITE_SENT',
      entityType: 'Invite',
      entityId: invite._id.toString(),
      description: `Admin sent invite to ${email} as ${role}`,
      req,
      metadata: {
        inviteEmail: email,
        inviteRole: role,
      },
    });

    // Return success (do NOT return the raw token in production)
    sendSuccess(
      res,
      {
        invite: {
          id: invite._id.toString(),
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
        },
        // In development, return the URL for testing
        ...(process.env.NODE_ENV === 'development' && { inviteUrl }),
      },
      'Invite sent successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /invites/validate
 * Validate an invite token (Public)
 */
export const validateInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      sendError(res, 'Token is required', 400);
      return;
    }

    // Hash the token
    const tokenHash = hashInviteToken(token);

    // Find invite
    const invite = await Invite.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      sendError(res, 'Invalid or expired invite token', 400);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Return invite details
    sendSuccess(
      res,
      {
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      'Invite is valid'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /invites/accept
 * Accept an invite and create user account (Public)
 */
export const acceptInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = acceptInviteSchema.parse(req.body);
    const { token, name, password } = validatedData;

    // Hash the token
    const tokenHash = hashInviteToken(token);

    // Find and validate invite
    const invite = await Invite.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      sendError(res, 'Invalid or expired invite token', 400);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with role from invite
    const user = new User({
      name,
      email: invite.email,
      passwordHash,
      role: invite.role, // Role is enforced from invite
      isActive: true,
    });

    await user.save();

    // Automatically send verification email
    const { sendVerificationEmailForUser } = await import('../utils/sendVerificationEmail');
    await sendVerificationEmailForUser(user._id.toString(), user.email);

    // Mark invite as used
    invite.used = true;
    await invite.save();

    // Audit log: Invite accepted
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'INVITE_ACCEPTED',
      entityType: 'Invite',
      entityId: invite._id.toString(),
      description: `User accepted invite and created account: ${user.email}`,
      req,
      metadata: {
        userEmail: user.email,
        userRole: user.role,
        inviteEmail: invite.email,
      },
    });

    // Return success
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
      'Account created successfully. Please login.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/invites
 * List all invites (Admin only)
 */
export const listInvites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    // Build filter
    const filter: any = {};

    if (status === 'pending') {
      filter.used = false;
      filter.expiresAt = { $gt: new Date() };
    } else if (status === 'expired') {
      filter.expiresAt = { $lte: new Date() };
      filter.used = false;
    } else if (status === 'used') {
      filter.used = true;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch invites
    const [invites, total] = await Promise.all([
      Invite.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Invite.countDocuments(filter),
    ]);

    // Format response
    const formattedInvites = invites.map((invite: any) => {
      const isExpired = new Date(invite.expiresAt) <= new Date();
      let status = 'pending';
      if (invite.used) {
        status = 'used';
      } else if (isExpired) {
        status = 'expired';
      }

      return {
        id: invite._id.toString(),
        email: invite.email,
        role: invite.role,
        status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        createdBy: invite.createdBy
          ? {
              id: invite.createdBy._id.toString(),
              name: invite.createdBy.name,
              email: invite.createdBy.email,
            }
          : null,
      };
    });

    sendSuccess(
      res,
      {
        invites: formattedInvites,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Invites fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

