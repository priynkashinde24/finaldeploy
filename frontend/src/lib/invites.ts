import { api } from './api';

export interface Invite {
  id: string;
  email: string;
  role: 'supplier' | 'reseller';
  status: 'pending' | 'expired' | 'used';
  expiresAt: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInviteData {
  email: string;
  role: 'supplier' | 'reseller';
}

export interface ValidateInviteResponse {
  success: boolean;
  data?: {
    email: string;
    role: 'supplier' | 'reseller';
    expiresAt: string;
  };
  message?: string;
}

export interface AcceptInviteData {
  token: string;
  name: string;
  password: string;
}

export interface InvitesResponse {
  success: boolean;
  data?: {
    invites: Invite[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

/**
 * Create an invite (Admin only)
 */
export const createInvite = async (data: CreateInviteData) => {
  try {
    const response = await api.post('/invites/admin', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create invite',
    };
  }
};

/**
 * Validate an invite token (Public)
 */
export const validateInvite = async (token: string): Promise<ValidateInviteResponse> => {
  try {
    const response = await api.get(`/invites/validate?token=${encodeURIComponent(token)}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Invalid invite token',
    };
  }
};

/**
 * Accept an invite and create account (Public)
 */
export const acceptInvite = async (data: AcceptInviteData) => {
  try {
    const response = await api.post('/invites/accept', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to accept invite',
    };
  }
};

/**
 * List all invites (Admin only)
 */
export const listInvites = async (filters: { status?: 'pending' | 'expired' | 'used'; page?: number; limit?: number } = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/invites/admin?${params.toString()}`);
    return response.data as InvitesResponse;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch invites',
    } as InvitesResponse;
  }
};

