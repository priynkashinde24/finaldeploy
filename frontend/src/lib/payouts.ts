/**
 * Payout API Layer
 * 
 * Functions for managing payouts (reseller earnings, supplier payouts, admin management)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ResellerPayout {
  id: string;
  orderId: string;
  orderAmount: number;
  marginAmount: number;
  payoutAmount: number;
  payoutStatus: 'pending' | 'processed' | 'failed';
  payoutDate?: string;
  failureReason?: string;
  createdAt: string;
}

export interface SupplierPayout {
  id: string;
  orderId: string;
  orderAmount: number;
  costAmount: number;
  payoutAmount: number;
  payoutStatus: 'pending' | 'processed' | 'failed';
  payoutDate?: string;
  failureReason?: string;
  createdAt: string;
}

export interface AdminPayout {
  id: string;
  type: 'reseller' | 'supplier';
  resellerId?: string;
  resellerName?: string;
  resellerEmail?: string;
  supplierId?: string;
  supplierName?: string;
  supplierEmail?: string;
  orderId: string;
  orderAmount: number;
  marginAmount?: number;
  costAmount?: number;
  payoutAmount: number;
  payoutStatus: 'pending' | 'processed' | 'failed';
  payoutDate?: string;
  failureReason?: string;
  createdAt: string;
}

export interface PayoutTotals {
  reseller: {
    totalPending: number;
    totalProcessed: number;
    totalFailed: number;
    totalPendingAmount: number;
    totalProcessedAmount: number;
  };
  supplier: {
    totalPending: number;
    totalProcessed: number;
    totalFailed: number;
    totalPendingAmount: number;
    totalProcessedAmount: number;
  };
}

export interface GetPayoutsResponse {
  success: boolean;
  data?: {
    payouts: {
      resellerPayouts: ResellerPayout[];
      supplierPayouts: SupplierPayout[];
    };
    totals: PayoutTotals;
  };
  message?: string;
}

/**
 * Get reseller payouts (earnings)
 */
export async function getResellerPayouts(): Promise<{
  success: boolean;
  data?: ResellerPayout[];
  message?: string;
}> {
  try {
    // Use the api instance from api.ts to ensure proper headers (including x-store-id) are sent
    const { api } = await import('./api');
    
    const response = await api.get('/reseller/payouts');
    const data = response.data;

    if (data.success && data.data) {
      // Backend now returns formatted payouts with order data
      const payouts = (data.data.payouts || []).map((p: any) => ({
        id: p.id || p._id?.toString(),
        orderId: p.orderId || 'N/A',
        orderNumber: p.orderNumber || p.orderId,
        orderAmount: p.orderAmount || 0,
        marginAmount: p.marginAmount || p.payoutAmount || 0,
        payoutAmount: p.payoutAmount || p.amount || 0,
        payoutStatus: p.payoutStatus || (p.status === 'paid' ? 'processed' : 'pending'),
        payoutDate: p.payoutDate || p.paidAt || p.availableAt || p.createdAt,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
      }));

      return { success: true, data: payouts };
    }

    return { success: false, message: data.message || 'Failed to fetch payouts' };
  } catch (error: any) {
    console.error('Error fetching reseller payouts:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || error.message || 'Network error' 
    };
  }
}

/**
 * Get supplier payouts
 */
export async function getSupplierPayouts(): Promise<{
  success: boolean;
  data?: SupplierPayout[];
  message?: string;
}> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/supplier/payouts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch payouts' };
    }

    // Map response data to SupplierPayout format
    const payouts: SupplierPayout[] = (data.data?.payouts || []).map((p: any) => ({
      id: p._id?.toString() || p.id,
      orderId: p.orderId,
      orderAmount: p.orderAmount,
      costAmount: p.costAmount,
      payoutAmount: p.payoutAmount,
      payoutStatus: p.payoutStatus,
      payoutDate: p.payoutDate,
      failureReason: p.failureReason,
      createdAt: p.createdAt,
    }));

    return { success: true, data: payouts };
  } catch (error) {
    console.error('Error fetching supplier payouts:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Get admin payouts (all payouts with filters)
 */
export async function getAdminPayouts(params?: {
  role?: 'reseller' | 'supplier';
  status?: 'pending' | 'processed' | 'failed';
}): Promise<GetPayoutsResponse> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const queryParams = new URLSearchParams();
    if (params?.role) queryParams.append('role', params.role);
    if (params?.status) queryParams.append('status', params.status);

    const url = `${API_BASE_URL}/admin/payouts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to fetch payouts' };
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error fetching admin payouts:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Process a payout (admin only)
 */
export async function processPayout(
  payoutId: string,
  type: 'reseller' | 'supplier'
): Promise<{ success: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/process?type=${type}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to process payout' };
    }

    return { success: true, message: data.message || 'Payout processed successfully' };
  } catch (error) {
    console.error('Error processing payout:', error);
    return { success: false, message: 'Network error' };
  }
}

/**
 * Mark payout as failed (admin only)
 */
export async function failPayout(
  payoutId: string,
  type: 'reseller' | 'supplier',
  reason: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const response = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/fail?type=${type}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.message || 'Failed to mark payout as failed' };
    }

    return { success: true, message: data.message || 'Payout marked as failed' };
  } catch (error) {
    console.error('Error failing payout:', error);
    return { success: false, message: 'Network error' };
  }
}

