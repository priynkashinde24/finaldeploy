import { api } from './api';

/**
 * Admin Tax API Layer
 * 
 * Functions for managing Tax Categories
 * All endpoints require admin authentication
 */

// ==================== TYPES ====================

export interface TaxCategory {
  _id: string;
  name: string;
  taxType: 'gst' | 'vat';
  taxRate: number;
  applicableCategories: Array<{
    _id: string;
    name: string;
  }>;
  isGlobal: boolean;
  status: 'active' | 'inactive';
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxCategoryData {
  name: string;
  taxType: 'gst' | 'vat';
  taxRate: number;
  applicableCategories?: string[];
  isGlobal?: boolean;
  status?: 'active' | 'inactive';
}

export interface UpdateTaxCategoryData {
  name?: string;
  taxType?: 'gst' | 'vat';
  taxRate?: number;
  applicableCategories?: string[];
  isGlobal?: boolean;
  status?: 'active' | 'inactive';
}

export interface TaxCategoriesResponse {
  success: boolean;
  data?: {
    taxCategories: TaxCategory[];
    count: number;
  };
  message?: string;
}

export interface TaxCategoryResponse {
  success: boolean;
  data?: {
    taxCategory: TaxCategory;
  };
  message?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Get all tax categories
 */
export async function getTaxCategories(params?: {
  status?: 'active' | 'inactive';
  taxType?: 'gst' | 'vat';
  isGlobal?: boolean;
}): Promise<TaxCategoriesResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.taxType) queryParams.append('taxType', params.taxType);
    if (params?.isGlobal !== undefined) queryParams.append('isGlobal', params.isGlobal.toString());

    const url = `/admin/taxes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch tax categories',
    };
  }
}

/**
 * Get a single tax category by ID
 */
export async function getTaxCategory(id: string): Promise<TaxCategoryResponse> {
  try {
    const response = await api.get(`/admin/taxes/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch tax category',
    };
  }
}

/**
 * Create a new tax category
 */
export async function createTaxCategory(data: CreateTaxCategoryData): Promise<TaxCategoryResponse> {
  try {
    const response = await api.post('/admin/taxes', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create tax category',
    };
  }
}

/**
 * Update a tax category
 */
export async function updateTaxCategory(
  id: string,
  data: UpdateTaxCategoryData
): Promise<TaxCategoryResponse> {
  try {
    const response = await api.patch(`/admin/taxes/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update tax category',
    };
  }
}

/**
 * Disable a tax category
 */
export async function disableTaxCategory(id: string): Promise<TaxCategoryResponse> {
  try {
    const response = await api.patch(`/admin/taxes/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable tax category',
    };
  }
}

