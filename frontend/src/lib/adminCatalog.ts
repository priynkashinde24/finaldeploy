import { api } from './api';

/**
 * Admin Catalog API Layer
 * 
 * Functions for managing Categories and Attributes
 * All endpoints require admin authentication
 */

// ==================== TYPES ====================

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  parentId?: string | null;
  status: 'active' | 'inactive';
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  parentId?: string | null;
  status?: 'active' | 'inactive';
}

export interface Attribute {
  id: string;
  name: string;
  code: string;
  type: 'text' | 'number' | 'select';
  allowedValues?: string[];
  applicableCategories: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttributeData {
  name: string;
  code: string;
  type: 'text' | 'number' | 'select';
  allowedValues?: string[];
  applicableCategories: string[];
  status: 'active' | 'inactive';
}

export interface UpdateAttributeData {
  name?: string;
  code?: string;
  type?: 'text' | 'number' | 'select';
  allowedValues?: string[];
  applicableCategories?: string[];
  status?: 'active' | 'inactive';
}

export interface CategoriesResponse {
  success: boolean;
  data?: {
    categories: Category[];
    total: number;
  };
  message?: string;
}

export interface CategoryResponse {
  success: boolean;
  data?: {
    category: Category;
  };
  message?: string;
}

export interface AttributesResponse {
  success: boolean;
  data?: {
    attributes: Attribute[];
    total: number;
  };
  message?: string;
}

export interface AttributeResponse {
  success: boolean;
  data?: {
    attribute: Attribute;
  };
  message?: string;
}

// ==================== CATEGORY FUNCTIONS ====================

/**
 * Get all categories
 */
export const getCategories = async (): Promise<CategoriesResponse> => {
  try {
    const response = await api.get('/admin/categories');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch categories',
    };
  }
};

/**
 * Get category by ID
 */
export const getCategory = async (id: string): Promise<CategoryResponse> => {
  try {
    const response = await api.get(`/admin/categories/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch category',
    };
  }
};

/**
 * Create a new category
 */
export const createCategory = async (data: CreateCategoryData): Promise<CategoryResponse> => {
  try {
    const response = await api.post('/admin/categories', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create category',
    };
  }
};

/**
 * Update category
 */
export const updateCategory = async (id: string, data: UpdateCategoryData): Promise<CategoryResponse> => {
  try {
    const response = await api.patch(`/admin/categories/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update category',
    };
  }
};

/**
 * Toggle category status (active/inactive)
 */
export const toggleCategoryStatus = async (id: string, status: 'active' | 'inactive'): Promise<CategoryResponse> => {
  try {
    const response = await api.patch(`/admin/categories/${id}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update category status',
    };
  }
};

// ==================== ATTRIBUTE FUNCTIONS ====================

/**
 * Get all attributes
 */
export const getAttributes = async (): Promise<AttributesResponse> => {
  try {
    const response = await api.get('/admin/attributes');
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch attributes',
    };
  }
};

/**
 * Get attribute by ID
 */
export const getAttribute = async (id: string): Promise<AttributeResponse> => {
  try {
    const response = await api.get(`/admin/attributes/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch attribute',
    };
  }
};

/**
 * Create a new attribute
 */
export const createAttribute = async (data: CreateAttributeData): Promise<AttributeResponse> => {
  try {
    const response = await api.post('/admin/attributes', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create attribute',
    };
  }
};

/**
 * Update attribute
 */
export const updateAttribute = async (id: string, data: UpdateAttributeData): Promise<AttributeResponse> => {
  try {
    const response = await api.patch(`/admin/attributes/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update attribute',
    };
  }
};

/**
 * Toggle attribute status (active/inactive)
 */
export const toggleAttributeStatus = async (id: string, status: 'active' | 'inactive'): Promise<AttributeResponse> => {
  try {
    const response = await api.patch(`/admin/attributes/${id}`, { status });
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update attribute status',
    };
  }
};

