import { api } from './api';

/**
 * Storefront API Layer
 * 
 * Functions for customer-facing product listing
 * No authentication required
 */

// ==================== TYPES ====================

export interface StorefrontProduct {
  productId: string;
  productName: string;
  slug: string;
  category: string | null;
  categorySlug: string | null;
  subCategory: string | null;
  brand: string | null;
  images: string[];
  variantId: string;
  variantSku: string;
  attributes: Array<{
    attributeId: string;
    attributeName?: string;
    attributeCode?: string;
    value: string | number;
  }>;
  sellingPrice: number;
  resellerId: string;
  supplierId: string;
  stockAvailable: number;
}

export interface ProductVariantGroup {
  attributes: Array<{
    attributeId: string;
    attributeName?: string;
    attributeCode?: string;
    value: string | number;
  }>;
  variants: Array<{
    variantId: string;
    variantSku: string;
    sellingPrice: number;
    resellerId: string;
    supplierId: string;
    stockAvailable: number;
  }>;
}

export interface ProductDetails {
  product: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category: string | null;
    categorySlug: string | null;
    subCategory: string | null;
    brand: string | null;
    images: string[];
  };
  variants: ProductVariantGroup[];
}

export interface ProductsResponse {
  success: boolean;
  data?: {
    products: StorefrontProduct[];
  };
  message?: string;
}

export interface ProductDetailsResponse {
  success: boolean;
  data?: ProductDetails;
  message?: string;
}

// ==================== FUNCTIONS ====================

/**
 * Get all sellable products
 */
export const getProducts = async (): Promise<ProductsResponse> => {
  try {
    const response = await api.get('/storefront/products');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch products',
    };
  }
};

/**
 * Get product details by slug
 */
export const getProductBySlug = async (slug: string): Promise<ProductDetailsResponse> => {
  try {
    const response = await api.get(`/storefront/products/${slug}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch product',
    };
  }
};

/**
 * Get minimum price from product variants
 */
export const getMinPrice = (products: StorefrontProduct[]): number => {
  if (products.length === 0) return 0;
  return Math.min(...products.map((p) => p.sellingPrice));
};

/**
 * Get unique products (grouped by productId)
 */
export const getUniqueProducts = (products: StorefrontProduct[]): Map<string, StorefrontProduct> => {
  const uniqueProducts = new Map<string, StorefrontProduct>();
  
  products.forEach((product) => {
    if (!uniqueProducts.has(product.productId)) {
      uniqueProducts.set(product.productId, product);
    } else {
      // If product already exists, keep the one with lower price
      const existing = uniqueProducts.get(product.productId)!;
      if (product.sellingPrice < existing.sellingPrice) {
        uniqueProducts.set(product.productId, product);
      }
    }
  });
  
  return uniqueProducts;
};

