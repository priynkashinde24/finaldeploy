import { Request, Response, NextFunction } from 'express';
import { Session } from '../models/Session';
import { RefreshToken } from '../models/RefreshToken';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { revokeSession, revokeAllSessions, revokeAllSessionsExcept } from '../utils/sessionUtils';
import { z } from 'zod';

// Validation schemas
const revokeSessionSchema = z.object({
  refreshTokenId: z.string().min(1, 'Refresh token ID is required'),
});

/**
 * GET /sessions/me
 * List all active sessions for current user (Auth required)
 */
export const getMySessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Get current refresh token ID from cookie to identify current session
    const refreshTokenCookie = req.cookies?.refreshToken;
    let currentRefreshTokenId: string | null = null;

    if (refreshTokenCookie) {
      try {
        const { verifyRefreshToken } = await import('../utils/jwt');
        const decoded = verifyRefreshToken(refreshTokenCookie);
        currentRefreshTokenId = decoded.tokenId;
      } catch (error) {
        // Token invalid, continue without current session highlight
      }
    }

    // Fetch all active sessions for user
    const sessions = await Session.find({
      userId: currentUser.id,
      revoked: false,
    })
      .sort({ lastUsedAt: -1 })
      .lean();

    // Format response
    const formattedSessions = sessions.map((session: any) => ({
      id: session._id.toString(),
      refreshTokenId: session.refreshTokenId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceLabel: session.deviceLabel,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: session.refreshTokenId === currentRefreshTokenId,
    }));

    sendSuccess(
      res,
      {
        sessions: formattedSessions,
        currentRefreshTokenId,
      },
      'Sessions fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /sessions/revoke
 * Revoke a single session (Auth required)
 */
export const revokeSessionEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Validate request body
    const validatedData = revokeSessionSchema.parse(req.body);
    const { refreshTokenId } = validatedData;

    // Verify session belongs to current user
    const session = await Session.findOne({
      refreshTokenId,
      userId: currentUser.id,
    });

    if (!session) {
      sendError(res, 'Session not found', 404);
      return;
    }

    if (session.revoked) {
      sendError(res, 'Session already revoked', 400);
      return;
    }

    // Revoke session
    await revokeSession(refreshTokenId);

    // Revoke refresh token
    await RefreshToken.updateOne(
      { tokenId: refreshTokenId },
      { revoked: true }
    );

    sendSuccess(res, null, 'Session revoked successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /sessions/revoke-all
 * Revoke all sessions except current one (Auth required)
 */
export const revokeAllSessionsEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Get current refresh token ID
    const refreshTokenCookie = req.cookies?.refreshToken;
    if (!refreshTokenCookie) {
      sendError(res, 'Current session not found', 400);
      return;
    }

    let currentRefreshTokenId: string;
    try {
      const { verifyRefreshToken } = await import('../utils/jwt');
      const decoded = verifyRefreshToken(refreshTokenCookie) as any;
      currentRefreshTokenId = decoded.tokenId;
    } catch (error) {
      sendError(res, 'Invalid refresh token', 401);
      return;
    }

    // Revoke all sessions except current
    await revokeAllSessionsExcept(currentUser.id, currentRefreshTokenId);

    // Revoke all refresh tokens except current
    await RefreshToken.updateMany(
      {
        userId: currentUser.id,
        tokenId: { $ne: currentRefreshTokenId },
        revoked: false,
      },
      { revoked: true }
    );

    // Audit log: All sessions revoked
    const { logAudit } = await import('../utils/auditLogger');
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'ALL_SESSIONS_REVOKED',
      entityType: 'Session',
      description: `User revoked all other sessions`,
      req,
      metadata: {
        currentSessionPreserved: true,
      },
    });

    sendSuccess(res, null, 'All other sessions revoked successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/sessions/:userId
 * View sessions for a user (Admin only)
 */
export const getUserSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    // Fetch all sessions for user (including revoked)
    const sessions = await Session.find({ userId })
      .sort({ lastUsedAt: -1 })
      .lean();

    // Format response
    const formattedSessions = sessions.map((session: any) => ({
      id: session._id.toString(),
      refreshTokenId: session.refreshTokenId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceLabel: session.deviceLabel,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      revoked: session.revoked,
    }));

    sendSuccess(
      res,
      {
        sessions: formattedSessions,
      },
      'User sessions fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/sessions/:refreshTokenId/revoke
 * Revoke any session (Admin only)
 */
export const adminRevokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshTokenId } = req.params;

    // Find session
    const session = await Session.findOne({ refreshTokenId });

    if (!session) {
      sendError(res, 'Session not found', 404);
      return;
    }

    if (session.revoked) {
      sendError(res, 'Session already revoked', 400);
      return;
    }

    // Revoke session
    await revokeSession(refreshTokenId);

    // Revoke refresh token
    await RefreshToken.updateOne(
      { tokenId: refreshTokenId },
      { revoked: true }
    );

    // Audit log: Admin revoked session
    const { logAudit } = await import('../utils/auditLogger');
    const currentUser = req.user;
    if (currentUser) {
      await logAudit({
        actorId: currentUser.id,
        actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
        action: 'SESSION_REVOKED',
        entityType: 'Session',
        entityId: refreshTokenId,
        description: `Admin revoked session: ${session.deviceLabel}`,
        req,
        metadata: {
          targetUserId: session.userId.toString(),
          deviceLabel: session.deviceLabel,
          ipAddress: session.ipAddress,
        },
      });
    }

    sendSuccess(res, null, 'Session revoked successfully');
  } catch (error) {
    next(error);
  }
};

