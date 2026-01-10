import { api } from './api';

// In-memory storage for access token (not localStorage)
let accessTokenMemory: string | null = null;
let userMemory: User | null = null;

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'supplier' | 'reseller' | 'affiliate';
  name?: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    user: User;
  };
  message?: string;
}

export interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
  };
  message?: string;
}

export interface SignupResponse {
  success: boolean;
  data?: {
    accessToken: string;
    user: User;
  };
  message?: string;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'supplier' | 'reseller' | 'vendor' | 'customer' | 'delivery' | 'affiliate';
}

/**
 * Login with email and password
 */
export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    console.log('[AUTH] Login request:', { email });
    
    const response = await api.post('/auth/login', {
      email,
      password,
    }, {
      withCredentials: true, // Ensure cookies are sent
    });

    const data = response.data;
    console.log('[AUTH] Login response:', { success: data.success, hasToken: !!data.data?.accessToken, hasUser: !!data.data?.user });

    if (data.success && data.data?.accessToken) {
      // Store access token in memory (NOT localStorage)
      accessTokenMemory = data.data.accessToken;
      userMemory = data.data.user;
      
      const storedRole = data.data.user?.role;
      console.log('[AUTH] Tokens stored in memory:', { userId: data.data.user?.id, role: storedRole });
      console.log('[AUTH] Full user object stored:', data.data.user);
      console.log('[AUTH] Role verification - stored role:', storedRole, 'Type:', typeof storedRole);
      
      // Verify role is correct
      if (storedRole === 'affiliate') {
        console.log('[AUTH] ✅ Affiliate role confirmed - user should be redirected to /affiliate');
      } else if (storedRole === 'reseller') {
        console.log('[AUTH] ⚠️ User role is reseller, not affiliate. If this should be affiliate, update the database.');
      }
      
      // Clear any old localStorage data to prevent conflicts
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
      }
    }

    return data;
  } catch (error: any) {
    console.error('[AUTH] Login error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Login failed',
    };
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    // Call logout endpoint to clear refresh token cookie
    await api.post('/auth/logout');
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
  } finally {
    // Clear in-memory storage
    accessTokenMemory = null;
    userMemory = null;
    
    // Also clear localStorage if it exists (for backward compatibility)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
  }
};

/**
 * Get current access token (from memory)
 */
export const getAccessToken = (): string | null => {
  // Return from memory first, fallback to localStorage for backward compatibility
  if (accessTokenMemory) return accessTokenMemory;
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      accessTokenMemory = token; // Migrate to memory
      return token;
    }
  }
  return null;
};

/**
 * Get current user (from memory)
 */
export const getCurrentUser = (): User | null => {
  // Return from memory first, fallback to localStorage for backward compatibility
  if (userMemory) return userMemory;
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userMemory = user; // Migrate to memory
        return user;
      } catch {
        return null;
      }
    }
  }
  return null;
};

/**
 * Refresh access token using refresh token cookie
 */
export const refreshToken = async (): Promise<RefreshResponse> => {
  try {
    const response = await api.post('/auth/refresh', {}, {
      withCredentials: true, // Ensure cookies are sent
    });

    const data = response.data;

    if (data.success && data.data?.accessToken) {
      // Update access token in memory
      accessTokenMemory = data.data.accessToken;
      console.log('[AUTH] Token refreshed, updated in memory');
    }

    return data;
  } catch (error: any) {
    console.error('[AUTH] Token refresh error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Token refresh failed',
    };
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return getAccessToken() !== null;
};

/**
 * Get user role
 */
export const getUserRole = (): 'admin' | 'supplier' | 'reseller' | 'affiliate' | null => {
  const user = getCurrentUser();
  return user?.role || null;
};

/**
 * Sign up new user
 * Note: Registration does NOT auto-login per requirements
 */
export const signup = async (data: SignupData): Promise<SignupResponse> => {
  try {
    console.log('[SIGNUP] Sending registration request:', {
      name: data.name,
      email: data.email,
      role: data.role,
      passwordLength: data.password.length
    });

    const response = await api.post('/auth/register', {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
    });

    const responseData = response.data;
    console.log('[SIGNUP] Registration response:', responseData);

    // Registration does NOT auto-login - no token storage
    // User must login after registration

    return responseData;
  } catch (error: any) {
    console.error('[SIGNUP] Registration error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Signup failed',
    };
  }
};

/**
 * Request password reset
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send reset link',
    };
  }
};

/**
 * Validate reset token
 */
export const validateResetToken = async (token: string): Promise<{ success: boolean; data?: { valid: boolean }; message?: string }> => {
  try {
    const response = await api.get(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Invalid reset token',
    };
  }
};

/**
 * Reset password using token
 */
export const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to reset password',
    };
  }
};

/**
 * Send magic link for passwordless login
 */
export const sendMagicLink = async (email: string): Promise<{ success: boolean; message?: string }> => {
  try {
    console.log('[AUTH] Sending magic link:', { email });
    
    const response = await api.post('/auth/magic-link', { email }, {
      withCredentials: true,
    });

    const data = response.data;
    console.log('[AUTH] Magic link response:', { success: data.success, message: data.message });

    return data;
  } catch (error: any) {
    console.error('[AUTH] Magic link error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send magic link',
    };
  }
};

/**
 * Login with magic link token
 */
export const magicLogin = async (token: string): Promise<LoginResponse> => {
  try {
    console.log('[AUTH] Magic login request');
    
    const response = await api.get(`/auth/magic-login?token=${encodeURIComponent(token)}`, {
      withCredentials: true,
    });

    const data = response.data;
    console.log('[AUTH] Magic login response:', { success: data.success, hasToken: !!data.data?.accessToken, hasUser: !!data.data?.user });

    if (data.success && data.data?.accessToken) {
      // Store access token in memory (NOT localStorage)
      accessTokenMemory = data.data.accessToken;
      userMemory = data.data.user;
      console.log('[AUTH] Magic login successful, tokens stored in memory:', { userId: data.data.user?.id, role: data.data.user?.role });
    }

    return data;
  } catch (error: any) {
    console.error('[AUTH] Magic login error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Magic link login failed',
    };
  }
};

/**
 * Send OTP to phone number
 */
export const sendOTP = async (phone: string): Promise<{ success: boolean; message?: string }> => {
  try {
    console.log('[AUTH] Sending OTP:', { phone });
    
    const response = await api.post('/auth/otp/send', { phone }, {
      withCredentials: true,
    });

    const data = response.data;
    console.log('[AUTH] OTP send response:', { success: data.success, message: data.message });

    return data;
  } catch (error: any) {
    console.error('[AUTH] OTP send error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to send OTP',
    };
  }
};

/**
 * Verify OTP and login
 */
export const verifyOTP = async (phone: string, otp: string): Promise<LoginResponse> => {
  try {
    console.log('[AUTH] Verifying OTP');
    
    const response = await api.post('/auth/otp/verify', { phone, otp }, {
      withCredentials: true,
    });

    const data = response.data;
    console.log('[AUTH] OTP verify response:', { success: data.success, hasToken: !!data.data?.accessToken, hasUser: !!data.data?.user });

    if (data.success && data.data?.accessToken) {
      // Store access token in memory (NOT localStorage)
      accessTokenMemory = data.data.accessToken;
      userMemory = data.data.user;
      console.log('[AUTH] OTP login successful, tokens stored in memory:', { userId: data.data.user?.id, role: data.data.user?.role });
    }

    return data;
  } catch (error: any) {
    console.error('[AUTH] OTP verify error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'OTP verification failed',
    };
  }
};

