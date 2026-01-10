import { api } from './api';

/**
 * Send verification email (Authenticated or Public with email)
 */
export const sendVerificationEmail = async (email?: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post('/auth/send-verification', email ? { email } : {});
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send verification email',
    };
  }
};

/**
 * Verify email using token (Public)
 */
export const verifyEmail = async (token: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to verify email',
    };
  }
};

