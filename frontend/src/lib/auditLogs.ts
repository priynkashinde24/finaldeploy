import { api } from './api';

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supplier' | 'reseller';
}

export interface AuditLog {
  id: string;
  actor: AuditLogActor | null;
  actorRole: 'admin' | 'supplier' | 'reseller';
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data?: {
    logs: AuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface AuditLogDetailResponse {
  success: boolean;
  data?: {
    log: AuditLog;
  };
  message?: string;
}

export interface AuditLogFilters {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Get audit logs with filters (Admin only)
 */
export const getAuditLogs = async (filters: AuditLogFilters = {}): Promise<AuditLogsResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters.actorUserId) params.append('actorUserId', filters.actorUserId);
    if (filters.action) params.append('action', filters.action);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/admin/audit-logs?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch audit logs',
    };
  }
};

/**
 * Get audit log by ID (Admin only)
 */
export const getAuditLogById = async (id: string): Promise<AuditLogDetailResponse> => {
  try {
    const response = await api.get(`/admin/audit-logs/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch audit log',
    };
  }
};

