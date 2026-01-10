import { api } from './api';

/**
 * Admin Pricing API Layer
 * 
 * PURPOSE:
 * - Frontend functions to interact with admin pricing rule APIs
 * - Create, read, update, disable pricing rules
 */

export interface PricingRule {
  _id: string;
  scope: 'product' | 'variant' | 'category' | 'global';
  scopeId?: string | null;
  minMarginType: 'amount' | 'percentage';
  minMarginValue: number;
  maxDiscountPercentage?: number | null;
  minSellingPrice?: number | null;
  maxSellingPrice?: number | null;
  enforceOn: ('reseller' | 'storefront')[];
  status: 'active' | 'inactive';
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePricingRuleData {
  scope: 'product' | 'variant' | 'category' | 'global';
  scopeId?: string | null;
  minMarginType: 'amount' | 'percentage';
  minMarginValue: number;
  maxDiscountPercentage?: number | null;
  minSellingPrice?: number | null;
  maxSellingPrice?: number | null;
  enforceOn: ('reseller' | 'storefront')[];
  status?: 'active' | 'inactive';
}

export interface UpdatePricingRuleData {
  minMarginType?: 'amount' | 'percentage';
  minMarginValue?: number;
  maxDiscountPercentage?: number | null;
  minSellingPrice?: number | null;
  maxSellingPrice?: number | null;
  enforceOn?: ('reseller' | 'storefront')[];
  status?: 'active' | 'inactive';
}

export interface GetPricingRulesResponse {
  success: boolean;
  data?: {
    rules: PricingRule[];
  };
  message?: string;
}

export interface PricingRuleResponse {
  success: boolean;
  data?: {
    rule: PricingRule;
  };
  message?: string;
}

/**
 * Get all pricing rules
 */
export const getPricingRules = async (
  params?: { scope?: string; status?: string }
): Promise<GetPricingRulesResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.scope) queryParams.append('scope', params.scope);
    if (params?.status) queryParams.append('status', params.status);

    const url = `/admin/pricing-rules${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch pricing rules',
    };
  }
};

/**
 * Create a new pricing rule
 */
export const createPricingRule = async (data: CreatePricingRuleData): Promise<PricingRuleResponse> => {
  try {
    const response = await api.post('/admin/pricing-rules', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create pricing rule',
    };
  }
};

/**
 * Update a pricing rule
 */
export const updatePricingRule = async (
  id: string,
  data: UpdatePricingRuleData
): Promise<PricingRuleResponse> => {
  try {
    const response = await api.patch(`/admin/pricing-rules/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update pricing rule',
    };
  }
};

/**
 * Disable a pricing rule
 */
export const disablePricingRule = async (id: string): Promise<PricingRuleResponse> => {
  try {
    const response = await api.patch(`/admin/pricing-rules/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable pricing rule',
    };
  }
};

