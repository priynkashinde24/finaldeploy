import { api } from './api';

/**
 * Admin Promotions API Layer
 */

export interface Promotion {
  _id: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  maxDiscountAmount?: number | null;
  applicableScope: 'category' | 'product' | 'variant';
  scopeId: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'inactive';
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionData {
  name: string;
  description?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  maxDiscountAmount?: number | null;
  applicableScope: 'category' | 'product' | 'variant';
  scopeId: string;
  validFrom: string;
  validTo: string;
  status?: 'active' | 'inactive';
}

export interface UpdatePromotionData {
  name?: string;
  description?: string;
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  maxDiscountAmount?: number | null;
  validFrom?: string;
  validTo?: string;
  status?: 'active' | 'inactive';
}

export interface GetPromotionsResponse {
  success: boolean;
  data?: {
    promotions: Promotion[];
  };
  message?: string;
}

export interface PromotionResponse {
  success: boolean;
  data?: {
    promotion: Promotion;
  };
  message?: string;
}

/**
 * Get all promotions
 */
export const getPromotions = async (params?: { status?: string; scope?: string }): Promise<GetPromotionsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.scope) queryParams.append('scope', params.scope);

    const url = `/admin/promotions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch promotions',
    };
  }
};

/**
 * Create a new promotion
 */
export const createPromotion = async (data: CreatePromotionData): Promise<PromotionResponse> => {
  try {
    const response = await api.post('/admin/promotions', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create promotion',
    };
  }
};

/**
 * Update a promotion
 */
export const updatePromotion = async (id: string, data: UpdatePromotionData): Promise<PromotionResponse> => {
  try {
    const response = await api.patch(`/admin/promotions/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update promotion',
    };
  }
};

/**
 * Disable a promotion
 */
export const disablePromotion = async (id: string): Promise<PromotionResponse> => {
  try {
    const response = await api.patch(`/admin/promotions/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable promotion',
    };
  }
};

