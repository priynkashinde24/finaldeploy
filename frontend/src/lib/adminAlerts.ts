import { api } from './api';

/**
 * Admin Alerts API Layer
 * 
 * Functions for managing margin alerts
 * All endpoints require admin authentication
 */

export interface MarginAlert {
  _id: string;
  alertType: 'below_min_markup' | 'near_min_markup' | 'abnormally_high_markup' | 'sudden_margin_drop';
  scope: 'variant' | 'product' | 'brand' | 'reseller';
  scopeId?: string | null;
  resellerId?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  currentMargin: number;
  currentMarginPercent: number;
  expectedMinMargin: number;
  expectedMinMarginPercent: number;
  deviationPercentage: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  acknowledgedAt?: string | null;
  resolvedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  resolvedAt?: string | null;
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
 * Get all margin alerts (admin)
 */
export async function getAdminMarginAlerts(params?: {
  status?: string;
  severity?: string;
  alertType?: string;
  scope?: string;
  resellerId?: string;
}): Promise<{ success: boolean; alerts: MarginAlert[] }> {
  const response = await api.get('/admin/margin-alerts', { params });
  return response.data;
}

/**
 * Acknowledge a margin alert (admin)
 */
export async function acknowledgeMarginAlert(id: string): Promise<{ success: boolean; alert: MarginAlert }> {
  const response = await api.patch(`/admin/margin-alerts/${id}/acknowledge`);
  return response.data;
}

/**
 * Resolve a margin alert (admin)
 */
export async function resolveMarginAlert(id: string): Promise<{ success: boolean; alert: MarginAlert }> {
  const response = await api.patch(`/admin/margin-alerts/${id}/resolve`);
  return response.data;
}

