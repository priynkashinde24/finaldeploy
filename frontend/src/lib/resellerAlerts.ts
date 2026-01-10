import { api } from './api';

/**
 * Reseller Alerts API Layer
 * 
 * Functions for viewing margin alerts
 * Resellers can only view their own alerts
 */

export interface MarginAlert {
  _id: string;
  alertType: 'below_min_markup' | 'near_min_markup' | 'abnormally_high_markup' | 'sudden_margin_drop';
  scope: 'variant' | 'product' | 'brand' | 'reseller';
  scopeId?: string | null;
  currentMargin: number;
  currentMarginPercent: number;
  expectedMinMargin: number;
  expectedMinMarginPercent: number;
  deviationPercentage: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  metadata?: {
    sellingPrice?: number;
    supplierCost?: number;
    historicalAverage?: number;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get margin alerts for current reseller
 */
export async function getResellerMarginAlerts(params?: {
  status?: string;
  severity?: string;
}): Promise<{ success: boolean; alerts: MarginAlert[] }> {
  const response = await api.get('/reseller/margin-alerts', { params });
  return response.data;
}

