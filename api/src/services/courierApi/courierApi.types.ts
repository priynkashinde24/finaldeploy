/**
 * Courier API Integration Types
 * 
 * PURPOSE:
 * - Define interfaces for courier API integrations
 * - Support multiple courier providers
 * - Standardize tracking data format
 */

export interface CourierTrackingStatus {
  awbNumber: string;
  status: string;
  statusCode: string;
  statusDescription: string;
  location?: string;
  timestamp: Date;
  estimatedDelivery?: Date;
  currentLocation?: {
    city?: string;
    state?: string;
    pincode?: string;
  };
  events: Array<{
    status: string;
    description: string;
    location?: string;
    timestamp: Date;
  }>;
}

export interface CourierApiConfig {
  provider: 'shiprocket' | 'delhivery' | 'manual';
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface CourierApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CourierApiClient {
  /**
   * Get tracking status for an AWB number
   */
  getTrackingStatus(awbNumber: string): Promise<CourierApiResponse<CourierTrackingStatus>>;

  /**
   * Create shipment and get AWB number
   */
  createShipment(shipmentData: any): Promise<CourierApiResponse<{ awbNumber: string; labelUrl?: string }>>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

