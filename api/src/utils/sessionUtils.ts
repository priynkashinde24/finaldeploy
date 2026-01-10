import { Session } from '../models/Session';
import { UAParser } from 'ua-parser-js';

/**
 * Parse user agent string to get device label (browser + OS)
 */
export const parseUserAgent = (userAgent: string): string => {
  try {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();

    const browserName = browser.name || 'Unknown Browser';
    const browserVersion = browser.version ? ` ${browser.version}` : '';
    const osName = os.name || 'Unknown OS';
    const osVersion = os.version ? ` ${os.version}` : '';

    return `${browserName}${browserVersion} on ${osName}${osVersion}`.trim();
  } catch (error) {
    return 'Unknown Device';
  }
};

/**
 * Create a new session
 */
export const createSession = async (params: {
  userId: string;
  refreshTokenId: string;
  ipAddress: string;
  userAgent: string;
}): Promise<void> => {
  const { userId, refreshTokenId, ipAddress, userAgent } = params;

  const deviceLabel = parseUserAgent(userAgent);

  await Session.create({
    userId,
    refreshTokenId,
    ipAddress,
    userAgent,
    deviceLabel,
    lastUsedAt: new Date(),
    revoked: false,
  });
};

/**
 * Update lastUsedAt for a session
 */
export const touchSession = async (refreshTokenId: string): Promise<void> => {
  await Session.updateOne(
    { refreshTokenId, revoked: false },
    { lastUsedAt: new Date() }
  );
};

/**
 * Revoke a single session
 */
export const revokeSession = async (refreshTokenId: string): Promise<void> => {
  await Session.updateOne(
    { refreshTokenId },
    { revoked: true }
  );
};

/**
 * Revoke all sessions for a user
 */
export const revokeAllSessions = async (userId: string): Promise<void> => {
  await Session.updateMany(
    { userId, revoked: false },
    { revoked: true }
  );
};

/**
 * Revoke all sessions except the current one
 */
export const revokeAllSessionsExcept = async (userId: string, currentRefreshTokenId: string): Promise<void> => {
  await Session.updateMany(
    { userId, refreshTokenId: { $ne: currentRefreshTokenId }, revoked: false },
    { revoked: true }
  );
};

/**
 * Check if a session is revoked
 */
export const isSessionRevoked = async (refreshTokenId: string): Promise<boolean> => {
  const session = await Session.findOne({ refreshTokenId });
  return session ? session.revoked : true;
};

