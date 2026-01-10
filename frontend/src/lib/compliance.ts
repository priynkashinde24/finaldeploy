import { api } from './api';

/**
 * Compliance API Layer
 * 
 * Functions for pricing compliance dashboard
 * All endpoints require admin authentication
 */

export interface ComplianceSummary {
  totals: {
    products: number;
    compliantPercentage: number;
    nearRiskPercentage: number;
    violationPercentage: number;
  };
  marginStats: {
    averageMargin: number;
    byBrand: {
      brandId: string;
      brandName: string;
      averageMargin: number;
      productCount: number;
    }[];
    byRegion: any[];
    byReseller: {
      resellerId: string;
      averageMargin: number;
      productCount: number;
    }[];
  };
  alertsSummary: {
    open: number;
    highSeverity: number;
    recent: number;
  };
}

export interface ComplianceViolation {
  productId: string;
  variantId?: string | null;
  productName: string;
  brandId?: string | null;
  brandName?: string | null;
  regionId?: string | null;
  resellerId: string;
  resellerName: string;
  currentMargin: number;
  currentMarginPercent: number;
  requiredMinMargin: number;
  requiredMinMarginPercent: number;
  ruleViolated: string;
  severity: 'low' | 'medium' | 'high';
  deviationPercentage: number;
}

export interface ComplianceTrends {
  timeSeries: {
    date: string;
    avgMargin: number;
    violationCount: number;
  }[];
  marginDistribution: {
    '0-10%': number;
    '10-20%': number;
    '20-30%': number;
    '30-40%': number;
    '40-50%': number;
    '50%+': number;
  };
}

/**
 * Get compliance summary
 */
export async function getComplianceSummary(params?: {
  brandId?: string;
  regionId?: string;
  resellerId?: string;
}): Promise<{ success: boolean; data: ComplianceSummary }> {
  const response = await api.get('/admin/pricing-compliance/summary', { params });
  return response.data;
}

/**
 * Get compliance violations
 */
export async function getComplianceViolations(params?: {
  brandId?: string;
  regionId?: string;
  resellerId?: string;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<{ success: boolean; violations: ComplianceViolation[]; pagination: any }> {
  const response = await api.get('/admin/pricing-compliance/violations', { params });
  return response.data;
}

/**
 * Get compliance trends
 */
export async function getComplianceTrends(params?: {
  days?: number;
}): Promise<{ success: boolean; data: ComplianceTrends }> {
  const response = await api.get('/admin/pricing-compliance/trends', { params });
  return response.data;
}

