import axios from 'axios';

// Get API URL from environment variable or use sensible defaults.
// Important: in local development we should NOT hit the production backend by default.
const DEFAULT_DEV_API_URL = 'http://localhost:5000/api';
const DEFAULT_PROD_API_URL = 'https://alonecloneweb-application.vercel.app/api';
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_API_URL : DEFAULT_DEV_API_URL);

/**
 * Public routes that don't require CSRF token
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/invites/accept',
  '/api/invites/validate',
  '/api/auth/verify-email',
  '/api/auth/send-verification',
  '/api/auth/reset-password/validate',
  // Public analytics event ingestion (no CSRF required)
  '/api/analytics/conversion/event',
];

/**
 * State-changing HTTP methods that require CSRF protection
 */
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Get CSRF token from cookie
 */
const getCsrfToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
};

/**
 * Check if a URL is a public route
 */
const isPublicRoute = (url: string): boolean => {
  return PUBLIC_ROUTES.some((route) => url.includes(route));
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests (for refresh token)
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Add auth token if available (from memory)
    if (typeof window !== 'undefined') {
      const { getAccessToken } = await import('./auth');
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add store ID header (x-store-id) from localStorage or context
      const storeId = localStorage.getItem('storeId');
      if (storeId) {
        config.headers['x-store-id'] = storeId;
      }
    }

    // Add CSRF token for state-changing methods on protected routes
    const method = config.method?.toUpperCase() || '';
    const url = config.url || '';
    const fullUrl = `${config.baseURL}${url}`;

    if (
      STATE_CHANGING_METHODS.includes(method) &&
      !isPublicRoute(fullUrl)
    ) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh and CSRF errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Never attempt token refresh for auth endpoints themselves (prevents infinite refresh loops)
    const requestUrl: string = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

    // Handle CSRF token errors (403)
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.message || '';
      if (errorMessage.includes('CSRF') || errorMessage.includes('csrf')) {
        // CSRF token invalid or missing - force logout and redirect
        const { logout } = await import('./auth');
        await logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('CSRF token validation failed. Please login again.'));
      }
    }

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // If we don't currently have an access token, we are effectively "logged out".
      // Don't spam refresh calls in this state; just surface the 401 to the caller.
      if (typeof window !== 'undefined') {
        const { getAccessToken } = await import('./auth');
        const currentToken = getAccessToken();
        if (!currentToken) {
          return Promise.reject(error);
        }
      }

      originalRequest._retry = true;

      try {
        // Import auth helper dynamically to avoid circular dependency
        const { refreshToken } = await import('./auth');
        const refreshResponse = await refreshToken();

        if (refreshResponse.success && refreshResponse.data?.accessToken) {
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`;
          
          // Update CSRF token if available (it should be rotated on refresh)
          const csrfToken = getCsrfToken();
          if (csrfToken && STATE_CHANGING_METHODS.includes(originalRequest.method?.toUpperCase() || '')) {
            originalRequest.headers['X-CSRF-Token'] = csrfToken;
          }
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear memory and redirect to login
        const { logout } = await import('./auth');
        await logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.message || 'An error occurred';
      return Promise.reject(new Error(message));
    } else if (error.request) {
      // Request made but no response
      return Promise.reject(new Error('Network error. Please check your connection.'));
    } else {
      // Something else happened
      return Promise.reject(error);
    }
  }
);

// Store API methods
export const storeAPI = {
  create: async (data: {
    name: string;
    description: string;
    ownerId: string;
    logoUrl: string;
    themeId?: string;
    customDomain?: string;
  }) => {
    const response = await api.post('/stores', data);
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/stores/${id}`);
    return response.data;
  },

  getByOwner: async (ownerId: string) => {
    const response = await api.get(`/stores?ownerId=${ownerId}`);
    return response.data;
  },

  updateTheme: async (storeId: string, themeId: string) => {
    const response = await api.put(`/stores/${storeId}/theme`, { themeId });
    return response.data;
  },

  setDomain: async (storeId: string, domain: string) => {
    const response = await api.post(`/stores/${storeId}/domain`, { domain });
    return response.data;
  },

  verifyDomain: async (storeId: string) => {
    const response = await api.get(`/stores/${storeId}/domain/verify`);
    return response.data;
  },
};

// Catalog API methods
export const catalogAPI = {
  upload: async (file: File, supplierId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (supplierId) {
      formData.append('supplierId', supplierId);
    }
    
    const response = await api.post('/catalog/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Product API methods
export const productAPI = {
  getProducts: async (params?: {
    supplierId?: string;
    category?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const response = await api.get(`/products?${queryParams.toString()}`);
    return response.data;
  },
};

// User Profile API methods
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },
  updateProfile: async (data: { name?: string; phone?: string; phoneNumber?: string }) => {
    const response = await api.patch('/user/profile', data);
    return response.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.patch('/user/password', data);
    return response.data;
  },
};

// Reseller API methods
export const resellerAPI = {
  // Get available supplier products for selection
  getCatalog: async (params?: {
    category?: string;
    brand?: string;
    supplier?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.brand) queryParams.append('brand', params.brand);
    if (params?.supplier) queryParams.append('supplier', params.supplier);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    const url = `/reseller/catalog${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  // Select supplier variant and create reseller product
  selectProduct: async (data: {
    supplierVariantId: string;
    resellerPrice?: number;
    margin?: number;
  }) => {
    const response = await api.post('/reseller/products/select', data);
    return response.data;
  },

  // Get reseller's selected products
  getProducts: async () => {
    const response = await api.get('/reseller/products');
    return response.data;
  },

  // Legacy methods (for backward compatibility)
  addToCatalog: async (data: {
    supplierProductId: string;
    resellerPrice: number;
    resellerId?: string;
  }) => {
    const response = await api.post('/reseller/catalog/add', data);
    return response.data;
  },

  updatePrice: async (catalogItemId: string, resellerPrice: number, resellerId?: string) => {
    const response = await api.put(`/reseller/catalog/${catalogItemId}/price`, {
      resellerPrice,
      resellerId,
    });
    return response.data;
  },

  removeFromCatalog: async (catalogItemId: string, resellerId?: string) => {
    const params = resellerId ? `?resellerId=${resellerId}` : '';
    const response = await api.delete(`/reseller/catalog/${catalogItemId}${params}`);
    return response.data;
  },
};

// Pricing API methods
export const pricingAPI = {
  setGlobalMarkup: async (storeId: string, markupPercent: number) => {
    const response = await api.post('/pricing/global', { storeId, markupPercent });
    return response.data;
  },

  setSkuOverride: async (storeId: string, sku: string, markupPercent: number) => {
    const response = await api.post('/pricing/override', { storeId, sku, markupPercent });
    return response.data;
  },

  getStoreRules: async (storeId: string) => {
    const response = await api.get(`/pricing/${storeId}/rules`);
    return response.data;
  },

  calculatePrice: async (storeId: string, sku: string, basePrice: number) => {
    const response = await api.get(`/pricing/${storeId}/${sku}?basePrice=${basePrice}`);
    return response.data;
  },

  deleteOverride: async (storeId: string, overrideId: string) => {
    const response = await api.delete(`/pricing/${storeId}/override/${overrideId}`);
    return response.data;
  },
};

// Payout API methods
export const payoutAPI = {
  getPayouts: async (params?: {
    supplierId?: string;
    resellerId?: string;
    status?: 'pending' | 'completed' | 'failed';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.resellerId) queryParams.append('resellerId', params.resellerId);
    if (params?.status) queryParams.append('status', params.status);

    const response = await api.get(`/payouts?${queryParams.toString()}`);
    return response.data;
  },

  getPayoutByOrderId: async (orderId: string) => {
    const response = await api.get(`/payouts/order/${orderId}`);
    return response.data;
  },
};

// Shipping API methods
export const shippingAPI = {
  createLabel: async (data: { orderId: string; courier: 'standard' | 'express' | 'fedex' | 'ups' | 'usps' }) => {
    const response = await api.post('/shipping/create-label', data);
    return response.data;
  },

  getShippingByOrderId: async (orderId: string) => {
    const response = await api.get(`/shipping/${orderId}`);
    return response.data;
  },

  getShippingRates: async (orderId: string) => {
    const response = await api.get(`/shipping/rates/${orderId}`);
    return response.data;
  },

  getAllShipments: async (params?: {
    supplierId?: string;
    status?: 'created' | 'shipped' | 'delivered';
    courier?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.courier) queryParams.append('courier', params.courier);

    const response = await api.get(`/shipping?${queryParams.toString()}`);
    return response.data;
  },
};

// RMA API methods
export const rmaAPI = {
  submit: async (data: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      sku: string;
      quantity: number;
      reason: string;
    }>;
    notes?: string[];
  }) => {
    const response = await api.post('/rma/submit', data);
    return response.data;
  },

  calculateFee: async (orderId: string, items: Array<{ productId: string; sku: string; quantity: number }>) => {
    const response = await api.post('/rma/calculate-fee', { orderId, items });
    return response.data;
  },

  getById: async (rmaId: string) => {
    const response = await api.get(`/rma/${rmaId}`);
    return response.data;
  },

  approve: async (rmaId: string, note?: string) => {
    const response = await api.post(`/rma/${rmaId}/approve`, { note });
    return response.data;
  },

  decline: async (rmaId: string, note: string) => {
    const response = await api.post(`/rma/${rmaId}/decline`, { note });
    return response.data;
  },

  getAll: async (params?: {
    status?: 'submitted' | 'approved' | 'declined' | 'received' | 'refunded';
    customerId?: string;
    orderId?: string;
    storeId?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.customerId) queryParams.append('customerId', params.customerId);
    if (params?.orderId) queryParams.append('orderId', params.orderId);
    if (params?.storeId) queryParams.append('storeId', params.storeId);

    const response = await api.get(`/rma?${queryParams.toString()}`);
    return response.data;
  },
};

// Coupon API methods
export const couponAPI = {
  create: async (data: {
    code: string;
    type: 'percent' | 'fixed' | 'bogo' | 'tiered';
    value: number;
    conditions?: {
      minOrder?: number;
      productSkus?: string[];
      usageLimitPerUser?: number;
      maxRedemptions?: number;
    };
    storeId: string;
    startsAt?: string;
    endsAt?: string;
    active?: boolean;
  }) => {
    const response = await api.post('/coupons', data);
    return response.data;
  },

  validate: async (storeId: string, code: string, cart: any, userId?: string) => {
    const response = await api.post('/coupons/validate', { storeId, code, cart, userId });
    return response.data;
  },

  redeem: async (data: {
    userId: string;
    storeId: string;
    code: string;
    cart: any;
    orderId: string;
  }) => {
    const response = await api.post('/coupons/redeem', data);
    return response.data;
  },

  getAll: async (params?: { storeId?: string; active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.storeId) queryParams.append('storeId', params.storeId);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());

    const response = await api.get(`/coupons?${queryParams.toString()}`);
    return response.data;
  },

  getById: async (couponId: string) => {
    const response = await api.get(`/coupons/${couponId}`);
    return response.data;
  },

  update: async (couponId: string, data: { active?: boolean; endsAt?: string; value?: number; conditions?: any }) => {
    const response = await api.put(`/coupons/${couponId}`, data);
    return response.data;
  },
};

// Referral API methods
export const referralAPI = {
  generate: async (userId: string) => {
    const response = await api.post('/referrals/generate', { userId });
    return response.data;
  },

  redeem: async (code: string, userId: string, referredEmail?: string) => {
    const response = await api.post('/referrals/redeem', { code, userId, referredEmail });
    return response.data;
  },

  getByUser: async (userId: string) => {
    const response = await api.get(`/referrals/user/${userId}`);
    return response.data;
  },

  getStats: async (userId: string) => {
    const response = await api.get(`/referrals/stats/${userId}`);
    return response.data;
  },

  getAll: async (params?: { referrerUserId?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.referrerUserId) queryParams.append('referrerUserId', params.referrerUserId);
    if (params?.status) queryParams.append('status', params.status);

    const response = await api.get(`/referrals?${queryParams.toString()}`);
    return response.data;
  },
};

// Analytics API methods
export const analyticsAPI = {
  getSummary: async (storeId: string) => {
    const response = await api.get(`/analytics/${storeId}/summary`);
    return response.data;
  },

  getTimeseries: async (storeId: string, params?: {
    metric: string;
    from?: string;
    to?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.metric) queryParams.append('metric', params.metric);
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);

    const response = await api.get(`/analytics/${storeId}/timeseries?${queryParams.toString()}`);
    return response.data;
  },

  seedEvents: async (storeId: string, count: number = 5) => {
    const response = await api.post('/analytics/seed', { storeId, count });
    return response.data;
  },
};

// Event API methods
// Order Message API methods
export const orderMessageAPI = {
  getMessages: async (orderId: string) => {
    const response = await api.get(`/orders/${orderId}/messages`);
    return response.data;
  },

  createMessage: async (orderId: string, data: {
    content: string;
    channel?: 'in_app' | 'email' | 'whatsapp' | 'sms';
    messageType?: 'text' | 'attachment' | 'system_event';
    attachments?: Array<{
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    }>;
    isInternal?: boolean;
  }) => {
    const response = await api.post(`/orders/${orderId}/messages`, data);
    return response.data;
  },

  markMessageRead: async (orderId: string, messageId: string, role: 'customer' | 'admin' | 'supplier' | 'reseller') => {
    const response = await api.patch(`/orders/${orderId}/messages/${messageId}/read`, { role });
    return response.data;
  },

  closeThread: async (orderId: string) => {
    const response = await api.patch(`/orders/${orderId}/thread/close`);
    return response.data;
  },
};

// Sales Analytics API methods
// Conversion Analytics API methods
export const conversionAnalyticsAPI = {
  getSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/conversion/summary?${queryParams.toString()}`);
    return response.data;
  },

  getFunnel: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/conversion/funnel?${queryParams.toString()}`);
    return response.data;
  },

  getTimeseries: async (params: {
    metric?: string;
    interval?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.metric) queryParams.append('metric', params.metric);
    if (params.interval) queryParams.append('interval', params.interval);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/conversion/timeseries?${queryParams.toString()}`);
    return response.data;
  },

  exportAnalytics: async (params?: { startDate?: string; endDate?: string; format?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.format) queryParams.append('format', params.format);
    const response = await api.get(`/analytics/conversion/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

/**
 * Session-based conversion funnel dashboard APIs
 */
export const conversionDashboardAPI = {
  getOverview: async (params?: { startDate?: string; endDate?: string; device?: string; source?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.device) queryParams.append('device', params.device);
    if (params?.source) queryParams.append('source', params.source);
    const response = await api.get(`/analytics/conversion/overview?${queryParams.toString()}`);
    return response.data;
  },

  getFunnel: async (params?: { startDate?: string; endDate?: string; device?: string; source?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.device) queryParams.append('device', params.device);
    if (params?.source) queryParams.append('source', params.source);
    const response = await api.get(`/analytics/conversion/funnel?${queryParams.toString()}`);
    return response.data;
  },

  getTrend: async (params?: {
    startDate?: string;
    endDate?: string;
    interval?: 'daily' | 'weekly' | 'monthly';
    device?: string;
    source?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.interval) queryParams.append('interval', params.interval);
    if (params?.device) queryParams.append('device', params.device);
    if (params?.source) queryParams.append('source', params.source);
    const response = await api.get(`/analytics/conversion/trend?${queryParams.toString()}`);
    return response.data;
  },

  getBreakdown: async (params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'device' | 'source';
    device?: string;
    source?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.groupBy) queryParams.append('groupBy', params.groupBy);
    if (params?.device) queryParams.append('device', params.device);
    if (params?.source) queryParams.append('source', params.source);
    const response = await api.get(`/analytics/conversion/breakdown?${queryParams.toString()}`);
    return response.data;
  },
};

export const aovAnalyticsAPI = {
  getSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/summary?${queryParams.toString()}`);
    return response.data;
  },

  getTimeseries: async (params?: {
    granularity?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.granularity) queryParams.append('granularity', params.granularity);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/timeseries?${queryParams.toString()}`);
    return response.data;
  },

  getBreakdown: async (params?: {
    breakdownBy?: 'paymentMethod' | 'category' | 'customerType';
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.breakdownBy) queryParams.append('breakdownBy', params.breakdownBy);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/breakdown?${queryParams.toString()}`);
    return response.data;
  },

  exportData: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

/**
 * AOV Reports (Admin) — requested endpoints
 */
export const aovReportsAPI = {
  getOverview: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/overview?${queryParams.toString()}`);
    return response.data;
  },

  getTrend: async (params?: { interval?: 'daily' | 'weekly' | 'monthly'; startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.interval) queryParams.append('interval', params.interval);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/trend?${queryParams.toString()}`);
    return response.data;
  },

  byCategory: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/by-category?${queryParams.toString()}`);
    return response.data;
  },

  byChannel: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/aov/by-channel?${queryParams.toString()}`);
    return response.data;
  },

  highValueOrders: async (params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    minTotal?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.minTotal !== undefined) queryParams.append('minTotal', params.minTotal.toString());
    const response = await api.get(`/analytics/aov/high-value-orders?${queryParams.toString()}`);
    return response.data;
  },
};

export const skuHeatmapAPI = {
  getHeatmap: async (params?: {
    startDate?: string;
    endDate?: string;
    metric?: 'sales' | 'conversion' | 'returns' | 'inventory';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.metric) queryParams.append('metric', params.metric);
    const response = await api.get(`/analytics/sku/heatmap?${queryParams.toString()}`);
    return response.data;
  },

  getDetail: async (skuId: string, params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/sku/${skuId}/detail?${queryParams.toString()}`);
    return response.data;
  },

  getTop: async (params?: {
    startDate?: string;
    endDate?: string;
    metric?: 'sales' | 'conversion' | 'orders';
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.metric) queryParams.append('metric', params.metric);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const response = await api.get(`/analytics/sku/top?${queryParams.toString()}`);
    return response.data;
  },

  getBottom: async (params?: {
    startDate?: string;
    endDate?: string;
    metric?: 'sales' | 'conversion' | 'orders';
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.metric) queryParams.append('metric', params.metric);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const response = await api.get(`/analytics/sku/bottom?${queryParams.toString()}`);
    return response.data;
  },

  exportData: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/sku/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const salesAnalyticsAPI = {
  getSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/summary?${queryParams.toString()}`);
    return response.data;
  },

  getTimeseries: async (params: {
    metric: string;
    interval?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('metric', params.metric);
    if (params.interval) queryParams.append('interval', params.interval);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/timeseries?${queryParams.toString()}`);
    return response.data;
  },

  getTopProducts: async (params?: { limit?: number; startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/top-products?${queryParams.toString()}`);
    return response.data;
  },

  getReturns: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/returns?${queryParams.toString()}`);
    return response.data;
  },

  exportAnalytics: async (params?: { startDate?: string; endDate?: string; format?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.format) queryParams.append('format', params.format);
    const response = await api.get(`/analytics/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

/**
 * Admin analytics dashboard APIs
 * (Designed for SaaS-style dashboards: overview cards, charts, and paginated tables.)
 */
export const analyticsDashboardAPI = {
  getOverview: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/overview?${queryParams.toString()}`);
    return response.data;
  },

  getRevenue: async (params?: {
    range?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.range) queryParams.append('range', params.range);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/revenue?${queryParams.toString()}`);
    return response.data;
  },

  getCategorySales: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/categories?${queryParams.toString()}`);
    return response.data;
  },

  getOrderStatusDistribution: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/order-status?${queryParams.toString()}`);
    return response.data;
  },

  getOrders: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    orderStatus?: string;
    paymentStatus?: string;
    q?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.orderStatus) queryParams.append('orderStatus', params.orderStatus);
    if (params?.paymentStatus) queryParams.append('paymentStatus', params.paymentStatus);
    if (params?.q) queryParams.append('q', params.q);
    const response = await api.get(`/analytics/orders?${queryParams.toString()}`);
    return response.data;
  },
};

export const eventAPI = {
  create: async (data: {
    eventType: string;
    payload: Record<string, any>;
    storeId?: string;
    userId?: string;
    occurredAt?: string;
  }) => {
    const response = await api.post('/events', data);
    return response.data;
  },
};

export const deadStockAPI = {
  getAlerts: async (params?: { status?: string; severity?: string; limit?: number; skip?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.severity) queryParams.append('severity', params.severity);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    const response = await api.get(`/dead-stock-alerts?${queryParams.toString()}`);
    return response.data;
  },

  getAlert: async (alertId: string) => {
    const response = await api.get(`/dead-stock-alerts/${alertId}`);
    return response.data;
  },

  acknowledgeAlert: async (alertId: string, internalNote?: string) => {
    const response = await api.patch(`/dead-stock-alerts/${alertId}/acknowledge`, { internalNote });
    return response.data;
  },

  resolveAlert: async (alertId: string, resolutionReason?: string) => {
    const response = await api.patch(`/dead-stock-alerts/${alertId}/resolve`, { resolutionReason });
    return response.data;
  },

  getRules: async () => {
    const response = await api.get('/dead-stock-rules');
    return response.data;
  },

  createOrUpdateRule: async (data: {
    daysWithoutSales: number;
    minStockThreshold: number;
    velocityThreshold?: number;
    maxStockAgingDays?: number;
    severity: 'warning' | 'critical';
    isActive: boolean;
  }) => {
    const response = await api.post('/dead-stock-rules', data);
    return response.data;
  },

  getAnalytics: async () => {
    const response = await api.get('/dead-stock-analytics');
    return response.data;
  },
};

export const discountProposalAPI = {
  getProposals: async (params?: { status?: string; limit?: number; skip?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    const response = await api.get(`/discount-proposals?${queryParams.toString()}`);
    return response.data;
  },

  getProposal: async (proposalId: string) => {
    const response = await api.get(`/discount-proposals/${proposalId}`);
    return response.data;
  },

  approveProposal: async (proposalId: string) => {
    const response = await api.patch(`/discount-proposals/${proposalId}/approve`);
    return response.data;
  },

  rejectProposal: async (proposalId: string, rejectionReason?: string) => {
    const response = await api.patch(`/discount-proposals/${proposalId}/reject`, { rejectionReason });
    return response.data;
  },

  generateProposals: async () => {
    const response = await api.post('/discount-proposals/generate');
    return response.data;
  },

  getRules: async () => {
    const response = await api.get('/discount-rules');
    return response.data;
  },

  createOrUpdateRule: async (data: {
    minDaysSinceLastSale: number;
    minStockLevel: number;
    minStockValue?: number;
    severityFilter?: ('warning' | 'critical')[];
    discountStrategy: 'fixed' | 'percentage' | 'tiered';
    fixedDiscount?: number;
    percentageDiscount?: number;
    tieredDiscounts?: Array<{ daysThreshold: number; discountPercentage: number }>;
    maxDiscountPercent: number;
    minDiscountPercent: number;
    approvalRoles: ('admin' | 'supplier' | 'reseller')[];
    autoExpireDays: number;
    isActive: boolean;
  }) => {
    const response = await api.post('/discount-rules', data);
    return response.data;
  },
};

export const attributionAPI = {
  getOverview: async (params?: { startDate?: string; endDate?: string; attributionModel?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    const response = await api.get(`/analytics/attribution/overview?${queryParams.toString()}`);
    return response.data;
  },

  getByChannel: async (params?: {
    startDate?: string;
    endDate?: string;
    attributionModel?: string;
    channel?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    if (params?.channel) queryParams.append('channel', params.channel);
    const response = await api.get(`/analytics/attribution/by-channel?${queryParams.toString()}`);
    return response.data;
  },

  getPaths: async (params?: {
    startDate?: string;
    endDate?: string;
    attributionModel?: string;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const response = await api.get(`/analytics/attribution/paths?${queryParams.toString()}`);
    return response.data;
  },

  compareModels: async (params?: { startDate?: string; endDate?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    const response = await api.get(`/analytics/attribution/models-compare?${queryParams.toString()}`);
    return response.data;
  },

  // Backwards-compatible methods (older routes)
  getSummary: async (params?: { startDate?: string; endDate?: string; attributionModel?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    const response = await api.get(`/analytics/attribution/summary?${queryParams.toString()}`);
    return response.data;
  },

  getChannelPerformance: async (params?: {
    startDate?: string;
    endDate?: string;
    attributionModel?: string;
    channel?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    if (params?.channel) queryParams.append('channel', params.channel);
    const response = await api.get(`/analytics/attribution/channels?${queryParams.toString()}`);
    return response.data;
  },

  getROI: async (params?: { startDate?: string; endDate?: string; attributionModel?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.attributionModel) queryParams.append('attributionModel', params.attributionModel);
    const response = await api.get(`/analytics/attribution/roi?${queryParams.toString()}`);
    return response.data;
  },
};

export const tallyExportAPI = {
  exportSalesVouchers: async (params: {
    startDate: string;
    endDate: string;
    mode?: 'per_order' | 'daily';
    includeReceipts?: boolean;
    includeDiscountLedger?: boolean;
    partyLedgerMode?: 'customer' | 'cash';
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    if (params.mode) queryParams.append('mode', params.mode);
    if (params.includeReceipts !== undefined) queryParams.append('includeReceipts', String(params.includeReceipts));
    if (params.includeDiscountLedger !== undefined) {
      queryParams.append('includeDiscountLedger', String(params.includeDiscountLedger));
    }
    if (params.partyLedgerMode) {
      queryParams.append('partyLedgerMode', params.partyLedgerMode);
    }

    const response = await api.get(`/accounting/tally/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const quickbooksExportAPI = {
  exportTransactions: async (params: {
    startDate: string;
    endDate: string;
    mode?: 'per_order' | 'daily';
    includeReceipts?: boolean;
    includeDiscountLedger?: boolean;
    partyLedgerMode?: 'customer' | 'cash';
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    if (params.mode) queryParams.append('mode', params.mode);
    if (params.includeReceipts !== undefined) queryParams.append('includeReceipts', String(params.includeReceipts));
    if (params.includeDiscountLedger !== undefined) {
      queryParams.append('includeDiscountLedger', String(params.includeDiscountLedger));
    }
    if (params.partyLedgerMode) {
      queryParams.append('partyLedgerMode', params.partyLedgerMode);
    }

    const response = await api.get(`/accounting/quickbooks/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const xeroExportAPI = {
  exportTransactions: async (params: {
    startDate: string;
    endDate: string;
    mode?: 'per_order' | 'daily';
    includeReceipts?: boolean;
    includeDiscountLedger?: boolean;
    partyLedgerMode?: 'customer' | 'cash';
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    if (params.mode) queryParams.append('mode', params.mode);
    if (params.includeReceipts !== undefined) queryParams.append('includeReceipts', String(params.includeReceipts));
    if (params.includeDiscountLedger !== undefined) {
      queryParams.append('includeDiscountLedger', String(params.includeDiscountLedger));
    }
    if (params.partyLedgerMode) {
      queryParams.append('partyLedgerMode', params.partyLedgerMode);
    }

    const response = await api.get(`/accounting/xero/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const cryptoPaymentAPI = {
  createPayment: async (params: {
    orderId: string;
    cryptocurrency: 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'BNB' | 'MATIC';
  }) => {
    const response = await api.post('/payments/crypto/create', params);
    return response.data;
  },
  checkStatus: async (paymentId: string) => {
    const response = await api.get(`/payments/crypto/status/${paymentId}`);
    return response.data;
  },
};

export const supplierKycTierAPI = {
  getMyTier: async () => {
    const response = await api.get('/supplier/kyc-tier');
    return response.data;
  },
  requestUpgrade: async (tier: 'tier2' | 'tier3') => {
    const response = await api.post('/supplier/kyc-tier/request-upgrade', { tier });
    return response.data;
  },
  // Admin APIs
  listTiers: async (params?: { tier?: string; status?: string; supplierId?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.tier) queryParams.append('tier', params.tier);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    const response = await api.get(`/admin/kyc-tiers?${queryParams.toString()}`);
    return response.data;
  },
  getSupplierTier: async (supplierId: string) => {
    const response = await api.get(`/admin/kyc-tiers/${supplierId}`);
    return response.data;
  },
  assignTier: async (params: { supplierId: string; tier: 'tier1' | 'tier2' | 'tier3'; reason?: string }) => {
    const response = await api.post('/admin/kyc-tiers/assign', params);
    return response.data;
  },
  getTierDefinitions: async () => {
    const response = await api.get('/admin/kyc-tiers/definitions');
    return response.data;
  },
};

export const documentVaultAPI = {
  uploadDocument: async (formData: FormData) => {
    const response = await api.post('/vault/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  listDocuments: async (params?: {
    category?: string;
    status?: string;
    tag?: string;
    search?: string;
    ownerId?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.ownerId) queryParams.append('ownerId', params.ownerId);
    if (params?.relatedEntityType) queryParams.append('relatedEntityType', params.relatedEntityType);
    if (params?.relatedEntityId) queryParams.append('relatedEntityId', params.relatedEntityId);
    const response = await api.get(`/vault/documents?${queryParams.toString()}`);
    return response.data;
  },
  getDocument: async (documentId: string) => {
    const response = await api.get(`/vault/documents/${documentId}`);
    return response.data;
  },
  downloadDocument: async (documentId: string, version?: number) => {
    const queryParams = version ? `?version=${version}` : '';
    const response = await api.get(`/vault/documents/${documentId}/download${queryParams}`, {
      responseType: 'blob',
    });
    return response.data;
  },
  uploadNewVersion: async (documentId: string, formData: FormData) => {
    const response = await api.post(`/vault/documents/${documentId}/versions`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  shareDocument: async (documentId: string, params: {
    sharedWith: string;
    permissions: ('read' | 'write' | 'delete' | 'share')[];
    expiresAt?: string;
  }) => {
    const response = await api.post(`/vault/documents/${documentId}/share`, params);
    return response.data;
  },
  deleteDocument: async (documentId: string) => {
    const response = await api.delete(`/vault/documents/${documentId}`);
    return response.data;
  },
};

