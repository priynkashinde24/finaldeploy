import { api } from './api';

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  brand?: string;
  images: string[];
  basePrice: number;
  status: 'active' | 'inactive';
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductData {
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  brand?: string;
  images?: string[];
  basePrice: number;
  status?: 'active' | 'inactive';
}

export interface UpdateProductData {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  brand?: string;
  images?: string[];
  basePrice?: number;
  status?: 'active' | 'inactive';
}

export interface ProductsResponse {
  success: boolean;
  data?: {
    products: Product[];
  };
  message?: string;
}

export interface ProductResponse {
  success: boolean;
  data?: {
    product: Product;
  };
  message?: string;
}

/**
 * Get all products
 */
export const getProducts = async (): Promise<ProductsResponse> => {
  try {
    const response = await api.get('/admin/products');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch products',
    };
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (id: string): Promise<ProductResponse> => {
  try {
    const response = await api.get(`/admin/products/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch product',
    };
  }
};

/**
 * Create a new product
 */
export const createProduct = async (data: CreateProductData): Promise<ProductResponse> => {
  try {
    const response = await api.post('/admin/products', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create product',
    };
  }
};

/**
 * Update a product
 */
export const updateProduct = async (id: string, data: UpdateProductData): Promise<ProductResponse> => {
  try {
    const response = await api.patch(`/admin/products/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update product',
    };
  }
};

/**
 * Toggle product status (active/inactive)
 */
export const toggleProductStatus = async (id: string, status: 'active' | 'inactive'): Promise<ProductResponse> => {
  try {
    const response = await api.patch(`/admin/products/${id}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update product status',
    };
  }
};

