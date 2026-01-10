import { api } from './api';

/**
 * Admin Pricing Insights API Layer
 * 
 * Functions for managing pricing insights
 * All endpoints require admin authentication
 */

// ==================== TYPES ====================

export interface PricingInsight {
  _id: string;
  scope: 'product' | 'variant';
  scopeId: string;
  scopeName?: string; // Populated product/variant name
  scopeSku?: string; // Populated SKU
  currentPrice: number;
  suggestedPrice: number;
  suggestionReason: string;
  confidenceScore: number;
  metricsSnapshot: {
    avgDailyOrders: number;
    stockLevel: number;
    stockVelocity: number;
    avgMargin: number;
    priceElasticityScore: number;
    conversionRate?: number;
    competitorPrice?: number;
  };
  expectedImpact: {
    salesChange: 'increase' | 'decrease' | 'neutral';
    marginChange: 'increase' | 'decrease' | 'neutral';
    estimatedSalesChangePercent?: number;
    estimatedMarginChangePercent?: number;
  };
  adminConstraints: {
    minPrice: number | null;
    maxPrice: number | null;
    withinLimits: boolean;
  };
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingInsightsResponse {
  success: boolean;
  data?: {
    insights: PricingInsight[];
    count: number;
  };
  message?: string;
}

export interface PricingInsightResponse {
  success: boolean;
  data?: {
    insight: PricingInsight;
  };
  message?: string;
}

export interface GenerateInsightRequest {
  scope: 'product' | 'variant';
  scopeId: string;
}

export interface GenerateInsightResponse {
  success: boolean;
  data?: {
    insight: PricingInsight;
  };
  message?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Get all pricing insights
 */
export async function getPricingInsights(params?: {
  scope?: 'product' | 'variant';
  expired?: boolean;
}): Promise<PricingInsightsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.scope) queryParams.append('scope', params.scope);
    if (params?.expired) queryParams.append('expired', 'true');

    const url = `/admin/pricing-insights${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch pricing insights',
    };
  }
}

/**
 * Get a single pricing insight
 */
export async function getPricingInsight(
  scope: 'product' | 'variant',
  id: string
): Promise<PricingInsightResponse> {
  try {
    const response = await api.get(`/admin/pricing-insights/${scope}/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch pricing insight',
    };
  }
}

/**
 * Generate pricing insight for a product/variant
 */
export async function generatePricingInsight(
  data: GenerateInsightRequest
): Promise<GenerateInsightResponse> {
  try {
    const response = await api.post('/admin/pricing-insights/generate', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to generate pricing insight',
    };
  }
}

