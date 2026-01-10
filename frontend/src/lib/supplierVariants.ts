import { api } from './api';

/**
 * Supplier Variants API Layer
 * 
 * Functions for managing Supplier Product Variant Inventory
 * All endpoints require supplier authentication
 */

// ==================== TYPES ====================

export interface ProductWithVariants {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  brand?: string;
  images: string[];
  basePrice: number;
  status: 'active' | 'inactive';
  variants?: ProductVariant[];
}

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

export interface SupplierVariant {
  _id: string;
  supplierId: string;
  productId: string | ProductWithVariants;
  variantId?: string | ProductVariant;
  supplierSku: string;
  costPrice: number;
  stockQuantity: number;
  minOrderQty: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierVariantData {
  productId: string;
  variantId: string;
  supplierSku?: string;
  costPrice: number;
  stockQuantity: number;
  minOrderQty: number;
  status?: 'active' | 'inactive';
}

export interface UpdateSupplierVariantData {
  supplierSku?: string;
  costPrice?: number;
  stockQuantity?: number;
  minOrderQty?: number;
  status?: 'active' | 'inactive';
}

export interface SupplierVariantsResponse {
  success: boolean;
  data?: {
    products: SupplierVariant[];
  };
  message?: string;
}

export interface ProductsWithVariantsResponse {
  success: boolean;
  data?: {
    products: ProductWithVariants[];
  };
  message?: string;
}

export interface SupplierVariantResponse {
  success: boolean;
  data?: {
    product: SupplierVariant;
  };
  message?: string;
}

// ==================== FUNCTIONS ====================

/**
 * Get supplier's variant inventory (mapped products with variants)
 */
export const getSupplierVariants = async (): Promise<SupplierVariantsResponse> => {
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
 * Get all active global products with their active variants (for mapping)
 * Note: This attempts to fetch variants, but if the endpoint is not available,
 * it will return products without variants. The UI should handle this gracefully.
 */
export const getProductsWithVariants = async (): Promise<ProductsWithVariantsResponse> => {
  try {
    // First get all active products
    const productsResponse = await api.get('/supplier/products/global');
    if (!productsResponse.data.success || !productsResponse.data.data) {
      return {
        success: false,
        message: productsResponse.data.message || 'Failed to fetch products',
      };
    }

    const products = productsResponse.data.data.products;

    // For each product, try to fetch its variants
    // Note: This uses admin endpoint which may not be accessible to suppliers
    // In production, you should create a supplier-friendly endpoint like:
    // GET /supplier/products/:id/variants
    const productsWithVariants: ProductWithVariants[] = await Promise.all(
      products.map(async (product: any) => {
        try {
          // Try to fetch variants - if this fails, product will have no variants
          // In a real implementation, you'd have a supplier-specific endpoint
          const variantsResponse = await api.get(`/admin/products/${product._id}/variants`);
          if (variantsResponse.data.success && variantsResponse.data.data) {
            // Filter only active variants
            const activeVariants = variantsResponse.data.data.variants.filter(
              (v: ProductVariant) => v.status === 'active'
            );
            return {
              ...product,
              variants: activeVariants,
            };
          }
          return { ...product, variants: [] };
        } catch (err) {
          // If variants endpoint fails (e.g., 403 Forbidden), return product without variants
          // This is expected if suppliers don't have access to admin endpoints
          console.warn(`Could not fetch variants for product ${product._id}:`, err);
          return { ...product, variants: [] };
        }
      })
    );

    // Filter products that have at least one variant
    const productsWithActiveVariants = productsWithVariants.filter(
      (p) => p.variants && p.variants.length > 0
    );

    return {
      success: true,
      data: {
        products: productsWithActiveVariants,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch products with variants',
    };
  }
};

/**
 * Create supplier variant mapping (map inventory to variant)
 */
export const createSupplierVariant = async (
  data: CreateSupplierVariantData
): Promise<SupplierVariantResponse> => {
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
 * Update supplier variant
 */
export const updateSupplierVariant = async (
  id: string,
  data: UpdateSupplierVariantData
): Promise<SupplierVariantResponse> => {
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
 * Toggle supplier variant status
 */
export const toggleSupplierVariantStatus = async (
  id: string,
  status: 'active' | 'inactive'
): Promise<SupplierVariantResponse> => {
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

