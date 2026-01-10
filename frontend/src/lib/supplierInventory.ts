import { api } from './api';

export interface GlobalProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  brand?: string;
  images: string[];
  basePrice: number;
  status: 'active' | 'inactive';
}

export interface SupplierProduct {
  _id: string;
  supplierId: string;
  productId: string | GlobalProduct;
  variantId?: string;
  supplierSku: string;
  costPrice: number;
  stockQuantity: number;
  minOrderQty: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierProductData {
  productId: string;
  variantId?: string;
  supplierSku: string;
  costPrice: number;
  stockQuantity: number;
  minOrderQty: number;
  status?: 'active' | 'inactive';
}

export interface UpdateSupplierProductData {
  supplierSku?: string;
  costPrice?: number;
  stockQuantity?: number;
  minOrderQty?: number;
  status?: 'active' | 'inactive';
}

export interface SupplierProductsResponse {
  success: boolean;
  data?: {
    products: SupplierProduct[];
  };
  message?: string;
}

export interface GlobalProductsResponse {
  success: boolean;
  data?: {
    products: GlobalProduct[];
  };
  message?: string;
}

export interface SupplierProductResponse {
  success: boolean;
  data?: {
    product: SupplierProduct;
  };
  message?: string;
}

/**
 * Get supplier's inventory (mapped products)
 */
export const getSupplierProducts = async (): Promise<SupplierProductsResponse> => {
  try {
    const response = await api.get('/supplier/products');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch inventory',
    };
  }
};

/**
 * Get all active global products (for mapping)
 */
export const getGlobalProducts = async (): Promise<GlobalProductsResponse> => {
  try {
    const response = await api.get('/supplier/products/global');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch global products',
    };
  }
};

/**
 * Create supplier product mapping (map inventory to global product)
 */
export const createSupplierProduct = async (data: CreateSupplierProductData): Promise<SupplierProductResponse> => {
  try {
    const response = await api.post('/supplier/products', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create inventory mapping',
    };
  }
};

/**
 * Update supplier product
 */
export const updateSupplierProduct = async (id: string, data: UpdateSupplierProductData): Promise<SupplierProductResponse> => {
  try {
    const response = await api.patch(`/supplier/products/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update inventory',
    };
  }
};

/**
 * Toggle supplier product status
 */
export const toggleSupplierProductStatus = async (id: string, status: 'active' | 'inactive'): Promise<SupplierProductResponse> => {
  try {
    const response = await api.patch(`/supplier/products/${id}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update status',
    };
  }
};

