import { api } from './api';

/**
 * Admin Variants API Layer
 * 
 * Functions for managing Product Variants
 * All endpoints require admin authentication
 */

// ==================== TYPES ====================

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  attributes: Array<{
    attributeId: string;
    attributeName?: string;
    attributeCode?: string;
    value: string | number;
  }>;
  basePrice: number;
  images?: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface GenerateVariantData {
  sku: string;
  attributes: Array<{
    attributeId: string;
    value: string | number;
  }>;
  basePrice: number;
  status: 'active' | 'inactive';
}

export interface UpdateVariantData {
  sku?: string;
  basePrice?: number;
  status?: 'active' | 'inactive';
}

export interface VariantsResponse {
  success: boolean;
  data?: {
    variants: ProductVariant[];
    total: number;
  };
  message?: string;
}

export interface VariantResponse {
  success: boolean;
  data?: {
    variant: ProductVariant;
  };
  message?: string;
}

export interface GenerateVariantsResponse {
  success: boolean;
  data?: {
    variants: ProductVariant[];
    created: number;
    skipped: number;
  };
  message?: string;
}

// ==================== VARIANT FUNCTIONS ====================

/**
 * Get all variants for a product
 */
export const getVariants = async (productId: string): Promise<VariantsResponse> => {
  try {
    const response = await api.get(`/admin/products/${productId}/variants`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch variants',
    };
  }
};

/**
 * Get variant by ID
 */
export const getVariant = async (variantId: string): Promise<VariantResponse> => {
  try {
    const response = await api.get(`/admin/variants/${variantId}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch variant',
    };
  }
};

/**
 * Generate variants in bulk for a product
 */
export const generateVariants = async (
  productId: string,
  variants: GenerateVariantData[]
): Promise<GenerateVariantsResponse> => {
  try {
    const response = await api.post(`/admin/products/${productId}/variants`, { variants });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to generate variants',
    };
  }
};

/**
 * Update variant
 */
export const updateVariant = async (variantId: string, data: UpdateVariantData): Promise<VariantResponse> => {
  try {
    const response = await api.patch(`/admin/variants/${variantId}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update variant',
    };
  }
};

/**
 * Toggle variant status (active/inactive)
 */
export const toggleVariantStatus = async (
  variantId: string,
  status: 'active' | 'inactive'
): Promise<VariantResponse> => {
  try {
    const response = await api.patch(`/admin/variants/${variantId}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update variant status',
    };
  }
};

