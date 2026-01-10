import { api } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supplier' | 'reseller';
  isActive: boolean;
  isEmailVerified: boolean;
  isBlocked: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  role: 'supplier' | 'reseller';
  password: string;
}

export interface UsersResponse {
  success: boolean;
  data?: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface UserResponse {
  success: boolean;
  data?: {
    user: User;
  };
  message?: string;
}

export interface Filters {
  role?: 'admin' | 'supplier' | 'reseller';
  status?: 'active' | 'inactive';
  page?: number;
  limit?: number;
}

/**
 * Fetch users with filters
 */
export const fetchUsers = async (filters: Filters = {}): Promise<UsersResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', filters.role);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch users',
    };
  }
};

/**
 * Create a new user (supplier or reseller)
 */
export const createUser = async (data: CreateUserData): Promise<UserResponse> => {
  try {
    const response = await api.post('/admin/users', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create user',
    };
  }
};

/**
 * Update user status (activate/deactivate)
 */
export const updateUserStatus = async (userId: string, isActive: boolean): Promise<UserResponse> => {
  try {
    const response = await api.patch(`/admin/users/${userId}/status`, { isActive });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update user status',
    };
  }
};

/**
 * Reset user password
 */
export const resetUserPassword = async (userId: string, newPassword: string): Promise<UserResponse> => {
  try {
    const response = await api.patch(`/admin/users/${userId}/reset-password`, { newPassword });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to reset password',
    };
  }
};

/**
 * Approve a user
 */
export const approveUser = async (userId: string): Promise<UserResponse> => {
  try {
    const response = await api.patch(`/admin/users/${userId}/approve`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to approve user',
    };
  }
};

/**
 * Block a user
 */
export const blockUser = async (userId: string): Promise<UserResponse> => {
  try {
    const response = await api.patch(`/admin/users/${userId}/block`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to block user',
    };
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string; data?: { deletedUserId: string; deletedUserEmail: string } }> => {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to delete user',
    };
  }
};

