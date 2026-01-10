import { api } from './api';

/**
 * Admin Coupons API Layer
 */

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number | null;
  applicableScope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  usageLimit?: number | null;
  usagePerUser?: number | null;
  usedCount: number;
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

export interface CreateCouponData {
  code: string;
  description?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number | null;
  applicableScope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  usageLimit?: number | null;
  usagePerUser?: number | null;
  validFrom: string;
  validTo: string;
  status?: 'active' | 'inactive';
}

export interface UpdateCouponData {
  description?: string;
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minOrderValue?: number | null;
  usageLimit?: number | null;
  usagePerUser?: number | null;
  validFrom?: string;
  validTo?: string;
  status?: 'active' | 'inactive';
}

export interface GetCouponsResponse {
  success: boolean;
  data?: {
    coupons: Coupon[];
  };
  message?: string;
}

export interface CouponResponse {
  success: boolean;
  data?: {
    coupon: Coupon;
  };
  message?: string;
}

/**
 * Get all coupons
 */
export const getCoupons = async (params?: { status?: string; scope?: string }): Promise<GetCouponsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.scope) queryParams.append('scope', params.scope);

    const url = `/admin/coupons${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch coupons',
    };
  }
};

/**
 * Create a new coupon
 */
export const createCoupon = async (data: CreateCouponData): Promise<CouponResponse> => {
  try {
    const response = await api.post('/admin/coupons', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create coupon',
    };
  }
};

/**
 * Update a coupon
 */
export const updateCoupon = async (id: string, data: UpdateCouponData): Promise<CouponResponse> => {
  try {
    const response = await api.patch(`/admin/coupons/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update coupon',
    };
  }
};

/**
 * Disable a coupon
 */
export const disableCoupon = async (id: string): Promise<CouponResponse> => {
  try {
    const response = await api.patch(`/admin/coupons/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable coupon',
    };
  }
};

