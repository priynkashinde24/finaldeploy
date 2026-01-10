import { api } from './api';

/**
 * Reseller Products API Layer
 * 
 * Functions for managing Reseller Product Catalog
 * All endpoints require reseller authentication
 */

// ==================== TYPES ====================

export interface Supplier {
  _id: string;
  name: string;
  email: string;
}

export interface SupplierVariant {
  _id: string;
  supplierId: string | Supplier;
  productId: string | any;
  variantId?: string | any;
  supplierSku: string;
  costPrice: number;
  stockQuantity: number;
  minOrderQty: number;
  status: 'active' | 'inactive';
}

export interface ResellerProduct {
  _id: string;
  resellerId: string;
  productId: string | any;
  variantId?: string | any;
  supplierId: string | Supplier;
  sellingPrice: number;
  margin: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateResellerProductData {
  productId: string;
  variantId: string;
  supplierId: string;
  sellingPrice: number;
  margin: number;
  status?: 'active' | 'inactive';
}

export interface UpdateResellerProductData {
  sellingPrice?: number;
  margin?: number;
  status?: 'active' | 'inactive';
}

export interface ResellerProductsResponse {
  success: boolean;
  data?: {
    products: ResellerProduct[];
  };
  message?: string;
}

export interface AvailableSupplierVariantsResponse {
  success: boolean;
  data?: {
    suppliers: Array<{
      _id: string;
      name: string;
      email: string;
      variants: SupplierVariant[];
    }>;
  };
  message?: string;
}

export interface ResellerProductResponse {
  success: boolean;
  data?: {
    product: ResellerProduct;
  };
  message?: string;
}

// ==================== FUNCTIONS ====================

/**
 * Get reseller's product catalog
 */
export const getResellerProducts = async (): Promise<ResellerProductsResponse> => {
  try {
    const response = await api.get('/reseller/products');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch products',
    };
  }
};

/**
 * Get available supplier variants (active + in-stock)
 */
export const getAvailableSupplierVariants = async (): Promise<AvailableSupplierVariantsResponse> => {
  try {
    // This endpoint should return suppliers with their available variants
    // For now, we'll use a placeholder - backend should implement this
    const response = await api.get('/reseller/products/available');
    return response.data;
  } catch (error: any) {
    // If endpoint doesn't exist, return empty
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch available variants',
    };
  }
};

/**
 * Create reseller product (add variant to catalog)
 */
export const createResellerProduct = async (
  data: CreateResellerProductData
): Promise<ResellerProductResponse> => {
  try {
    const response = await api.post('/reseller/products', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to add product',
    };
  }
};

/**
 * Update reseller product (margin, price, status)
 */
export const updateResellerProduct = async (
  id: string,
  data: UpdateResellerProductData
): Promise<ResellerProductResponse> => {
  try {
    const response = await api.patch(`/reseller/products/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update product',
    };
  }
};

/**
 * Toggle reseller product status
 */
export const toggleResellerProductStatus = async (
  id: string,
  status: 'active' | 'inactive'
): Promise<ResellerProductResponse> => {
  try {
    const response = await api.patch(`/reseller/products/${id}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update status',
    };
  }
};

