import { api } from './api';

/**
 * Admin Dynamic Pricing API Layer
 */

export interface DynamicPricingRule {
  _id: string;
  scope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  triggerType: 'low_stock' | 'high_demand' | 'time_window';
  conditions: {
    stockBelow?: number | null;
    ordersAbove?: number | null;
    startTime?: string | null;
    endTime?: string | null;
  };
  adjustmentType: 'increase' | 'decrease';
  adjustmentMode: 'percentage' | 'amount';
  adjustmentValue: number;
  maxAdjustmentLimit?: number | null;
  status: 'active' | 'inactive';
  priority: number;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDynamicPricingRuleData {
  scope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  triggerType: 'low_stock' | 'high_demand' | 'time_window';
  conditions: {
    stockBelow?: number | null;
    ordersAbove?: number | null;
    startTime?: string | null;
    endTime?: string | null;
  };
  adjustmentType: 'increase' | 'decrease';
  adjustmentMode: 'percentage' | 'amount';
  adjustmentValue: number;
  maxAdjustmentLimit?: number | null;
  status?: 'active' | 'inactive';
  priority: number;
}

export interface UpdateDynamicPricingRuleData {
  triggerType?: 'low_stock' | 'high_demand' | 'time_window';
  conditions?: {
    stockBelow?: number | null;
    ordersAbove?: number | null;
    startTime?: string | null;
    endTime?: string | null;
  };
  adjustmentType?: 'increase' | 'decrease';
  adjustmentMode?: 'percentage' | 'amount';
  adjustmentValue?: number;
  maxAdjustmentLimit?: number | null;
  status?: 'active' | 'inactive';
  priority?: number;
}

export interface GetDynamicPricingRulesResponse {
  success: boolean;
  data?: {
    rules: DynamicPricingRule[];
  };
  message?: string;
}

export interface DynamicPricingRuleResponse {
  success: boolean;
  data?: {
    rule: DynamicPricingRule;
  };
  message?: string;
}

/**
 * Get all dynamic pricing rules
 */
export const getDynamicPricingRules = async (
  params?: { status?: string; scope?: string; triggerType?: string }
): Promise<GetDynamicPricingRulesResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.scope) queryParams.append('scope', params.scope);
    if (params?.triggerType) queryParams.append('triggerType', params.triggerType);

    const url = `/admin/dynamic-pricing${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch dynamic pricing rules',
    };
  }
};

/**
 * Create a new dynamic pricing rule
 */
export const createDynamicPricingRule = async (
  data: CreateDynamicPricingRuleData
): Promise<DynamicPricingRuleResponse> => {
  try {
    const response = await api.post('/admin/dynamic-pricing', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create dynamic pricing rule',
    };
  }
};

/**
 * Update a dynamic pricing rule
 */
export const updateDynamicPricingRule = async (
  id: string,
  data: UpdateDynamicPricingRuleData
): Promise<DynamicPricingRuleResponse> => {
  try {
    const response = await api.patch(`/admin/dynamic-pricing/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update dynamic pricing rule',
    };
  }
};

/**
 * Disable a dynamic pricing rule
 */
export const disableDynamicPricingRule = async (id: string): Promise<DynamicPricingRuleResponse> => {
  try {
    const response = await api.patch(`/admin/dynamic-pricing/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable dynamic pricing rule',
    };
  }
};

