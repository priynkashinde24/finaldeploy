import { api } from './api';

/**
 * Admin Stores API Layer
 * 
 * Functions for managing Stores and Store Price Overrides
 * All endpoints require admin authentication
 */

// ==================== TYPES ====================

export interface Store {
  _id: string;
  name: string;
  code: string;
  ownerType: 'admin' | 'reseller';
  ownerId: string;
  status: 'draft' | 'active' | 'inactive';
  description?: string;
  slug: string;
  subdomain: string;
  themeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreData {
  name: string;
  code: string;
  ownerType?: 'admin' | 'reseller';
  ownerId?: string;
  status?: 'draft' | 'active' | 'inactive';
  description?: string;
}

export interface UpdateStoreData {
  name?: string;
  code?: string;
  status?: 'draft' | 'active' | 'inactive';
  description?: string;
}

export interface StorePriceOverride {
  _id: string;
  storeId: {
    _id: string;
    name: string;
    code: string;
  };
  scope: 'product' | 'variant' | 'category';
  scopeId: string;
  overrideType: 'fixed_price' | 'price_delta';
  overrideValue: number;
  status: 'active' | 'inactive';
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePriceOverrideData {
  scope: 'product' | 'variant' | 'category';
  scopeId: string;
  overrideType: 'fixed_price' | 'price_delta';
  overrideValue: number;
  status?: 'active' | 'inactive';
}

export interface UpdatePriceOverrideData {
  overrideType?: 'fixed_price' | 'price_delta';
  overrideValue?: number;
  status?: 'active' | 'inactive';
}

export interface StoresResponse {
  success: boolean;
  data?: {
    stores: Store[];
    count: number;
  };
  message?: string;
}

export interface StoreResponse {
  success: boolean;
  data?: {
    store: Store;
  };
  message?: string;
}

export interface PriceOverridesResponse {
  success: boolean;
  data?: {
    priceOverrides: StorePriceOverride[];
    count: number;
  };
  message?: string;
}

export interface PriceOverrideResponse {
  success: boolean;
  data?: {
    priceOverride: StorePriceOverride;
  };
  message?: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Get all stores
 */
export async function getStores(params?: {
  status?: 'draft' | 'active' | 'inactive';
  ownerType?: 'admin' | 'reseller';
}): Promise<StoresResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.ownerType) queryParams.append('ownerType', params.ownerType);

    const url = `/admin/stores${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch stores',
    };
  }
}

/**
 * Get a single store by ID
 */
export async function getStore(id: string): Promise<StoreResponse> {
  try {
    const response = await api.get(`/admin/stores/${id}`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch store',
    };
  }
}

/**
 * Create a new store
 */
export async function createStore(data: CreateStoreData): Promise<StoreResponse> {
  try {
    const response = await api.post('/admin/stores', data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create store',
    };
  }
}

/**
 * Update a store
 */
export async function updateStore(id: string, data: UpdateStoreData): Promise<StoreResponse> {
  try {
    const response = await api.patch(`/admin/stores/${id}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update store',
    };
  }
}

/**
 * Disable a store
 */
export async function disableStore(id: string): Promise<StoreResponse> {
  try {
    const response = await api.patch(`/admin/stores/${id}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable store',
    };
  }
}

/**
 * Get price overrides for a store
 */
export async function getPriceOverrides(
  storeId: string,
  params?: {
    status?: 'active' | 'inactive';
    scope?: 'product' | 'variant' | 'category';
  }
): Promise<PriceOverridesResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.scope) queryParams.append('scope', params.scope);

    const url = `/admin/stores/${storeId}/price-overrides${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch price overrides',
    };
  }
}

/**
 * Create a price override
 */
export async function createPriceOverride(
  storeId: string,
  data: CreatePriceOverrideData
): Promise<PriceOverrideResponse> {
  try {
    const response = await api.post(`/admin/stores/${storeId}/price-overrides`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create price override',
    };
  }
}

/**
 * Update a price override
 */
export async function updatePriceOverride(
  storeId: string,
  overrideId: string,
  data: UpdatePriceOverrideData
): Promise<PriceOverrideResponse> {
  try {
    const response = await api.patch(`/admin/stores/${storeId}/price-overrides/${overrideId}`, data);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update price override',
    };
  }
}

/**
 * Disable a price override
 */
export async function disablePriceOverride(storeId: string, overrideId: string): Promise<PriceOverrideResponse> {
  try {
    const response = await api.patch(`/admin/stores/${storeId}/price-overrides/${overrideId}/disable`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to disable price override',
    };
  }
}

