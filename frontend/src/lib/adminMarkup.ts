import { api } from './api';

/**
 * Admin Markup API Layer
 * 
 * PURPOSE:
 * - Frontend functions to interact with admin markup rule APIs
 * - Create, read, update, disable markup rules
 */

export interface MarkupRule {
  _id: string;
  scope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  minMarkupType: 'amount' | 'percentage';
  minMarkupValue: number;
  maxMarkupType?: 'amount' | 'percentage' | null;
  maxMarkupValue?: number | null;
  appliesTo: ('reseller' | 'store')[];
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

export interface CreateMarkupRuleData {
  scope: 'global' | 'category' | 'product' | 'variant';
  scopeId?: string | null;
  minMarkupType: 'amount' | 'percentage';
  minMarkupValue: number;
  maxMarkupType?: 'amount' | 'percentage' | null;
  maxMarkupValue?: number | null;
  appliesTo: ('reseller' | 'store')[];
  priority?: number;
  status?: 'active' | 'inactive';
}

export interface UpdateMarkupRuleData {
  minMarkupType?: 'amount' | 'percentage';
  minMarkupValue?: number;
  maxMarkupType?: 'amount' | 'percentage' | null;
  maxMarkupValue?: number | null;
  appliesTo?: ('reseller' | 'store')[];
  priority?: number;
  status?: 'active' | 'inactive';
}

/**
 * Get all markup rules
 */
export async function getMarkupRules(params?: {
  scope?: string;
  appliesTo?: string;
  status?: string;
}): Promise<{ success: boolean; rules: MarkupRule[] }> {
  const response = await api.get('/admin/markup-rules', { params });
  return response.data;
}

/**
 * Create a new markup rule
 */
export async function createMarkupRule(data: CreateMarkupRuleData): Promise<{ success: boolean; rule: MarkupRule }> {
  const response = await api.post('/admin/markup-rules', data);
  return response.data;
}

/**
 * Update a markup rule
 */
export async function updateMarkupRule(
  id: string,
  data: UpdateMarkupRuleData
): Promise<{ success: boolean; rule: MarkupRule }> {
  const response = await api.patch(`/admin/markup-rules/${id}`, data);
  return response.data;
}

/**
 * Disable a markup rule
 */
export async function disableMarkupRule(id: string): Promise<{ success: boolean; rule: MarkupRule }> {
  const response = await api.patch(`/admin/markup-rules/${id}/disable`);
  return response.data;
}

