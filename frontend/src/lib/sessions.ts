import { api } from './api';

export interface Session {
  id: string;
  refreshTokenId: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent?: boolean;
  revoked?: boolean;
}

export interface SessionsResponse {
  success: boolean;
  data?: {
    sessions: Session[];
    currentRefreshTokenId?: string;
  };
  message?: string;
}

/**
 * Get all active sessions for current user
 */
export const getMySessions = async (): Promise<SessionsResponse> => {
  try {
    const response = await api.get('/sessions/me');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch sessions',
    };
  }
};

/**
 * Revoke a single session
 */
export const revokeSession = async (refreshTokenId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post('/sessions/revoke', { refreshTokenId });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to revoke session',
    };
  }
};

/**
 * Revoke all sessions except current one
 */
export const revokeAllSessions = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post('/sessions/revoke-all');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to revoke sessions',
    };
  }
};

/**
 * Get sessions for a user (Admin only)
 */
export const getUserSessions = async (userId: string): Promise<SessionsResponse> => {
  try {
    const response = await api.get(`/sessions/admin/${userId}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch user sessions',
    };
  }
};

/**
 * Revoke any session (Admin only)
 */
export const adminRevokeSession = async (refreshTokenId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post(`/sessions/admin/${refreshTokenId}/revoke`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to revoke session',
    };
  }
};

