import { api } from './api';

export type ApprovalType = 'supplier' | 'kyc' | 'reseller';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PendingApproval {
  type: ApprovalType;
  entityId: string;
  name?: string;
  email: string;
  submittedAt: string;
  status: ApprovalStatus;
  rejectionReason?: string | null;
  metadata?: Record<string, any>;
}

export interface ApprovalsResponse {
  success: boolean;
  data?: {
    approvals: PendingApproval[];
    total: number;
  };
  message?: string;
}

export interface ApprovalActionResponse {
  success: boolean;
  data?: {
    approval: {
      type: ApprovalType;
      entityId: string;
      status: ApprovalStatus;
      approvedAt?: string;
      rejectionReason?: string;
      reviewedAt?: string;
    };
  };
  message?: string;
}

/**
 * Get all approvals (optionally filtered by status)
 */
export const getApprovals = async (status?: ApprovalStatus, type?: ApprovalType): Promise<ApprovalsResponse> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await api.get(`/admin/approvals?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch approvals',
    };
  }
};

/**
 * Approve an entity
 */
export const approveApproval = async (type: ApprovalType, id: string): Promise<ApprovalActionResponse> => {
  try {
    const response = await api.patch(`/admin/approvals/${type}/${id}/approve`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to approve',
    };
  }
};

/**
 * Reject an entity
 */
export const rejectApproval = async (type: ApprovalType, id: string, rejectionReason: string): Promise<ApprovalActionResponse> => {
  try {
    const response = await api.patch(`/admin/approvals/${type}/${id}/reject`, {
      rejectionReason,
    });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to reject',
    };
  }
};

