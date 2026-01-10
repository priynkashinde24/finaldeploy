import axios, { AxiosInstance } from 'axios';
import { CourierApiClient, CourierApiResponse, CourierTrackingStatus, CourierApiConfig } from './courierApi.types';
import crypto from 'crypto';

/**
 * Shiprocket API Client
 * 
 * PURPOSE:
 * - Integrate with Shiprocket API
 * - Get real-time tracking updates
 * - Create shipments
 * - Handle webhooks
 * 
 * DOCS: https://apidocs.shiprocket.in/
 */

export class ShiprocketClient implements CourierApiClient {
  private api: AxiosInstance;
  private config: CourierApiConfig;
  private authToken?: string;

  constructor(config: CourierApiConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.baseUrl || 'https://apiv2.shiprocket.in/v1/external',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Authenticate with Shiprocket API
   */
  private async authenticate(): Promise<string> {
    if (this.authToken) {
      return this.authToken;
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl || 'https://apiv2.shiprocket.in/v1/external'}/auth/login`,
        {
          email: this.config.apiKey, // Shiprocket uses email as API key
          password: this.config.apiSecret,
        }
      );

      this.authToken = response.data.token;
      if (!this.authToken) {
        throw new Error('Shiprocket authentication failed: No token received');
      }
      return this.authToken;
    } catch (error: any) {
      throw new Error(`Shiprocket authentication failed: ${error.message}`);
    }
  }

  /**
   * Get tracking status for an AWB number
   */
  async getTrackingStatus(awbNumber: string): Promise<CourierApiResponse<CourierTrackingStatus>> {
    try {
      const token = await this.authenticate();

      const response = await this.api.get(`/courier/track/awb/${awbNumber}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const trackingData = response.data.data?.tracking_data;
      if (!trackingData) {
        return {
          success: false,
          error: 'No tracking data found',
        };
      }

      // Map Shiprocket status to our format
      const status = this.mapShiprocketStatus(trackingData);

      return {
        success: true,
        data: {
          awbNumber,
          status: status.status,
          statusCode: status.statusCode,
          statusDescription: status.description,
          location: trackingData.current_status_location || undefined,
          timestamp: new Date(trackingData.updated_at || Date.now()),
          estimatedDelivery: trackingData.etd
            ? new Date(trackingData.etd)
            : undefined,
          currentLocation: trackingData.current_status_location
            ? {
                city: trackingData.current_status_location.split(',')[0],
                state: trackingData.current_status_location.split(',')[1],
              }
            : undefined,
          events: (trackingData.tracking_data || []).map((event: any) => ({
            status: event.status || '',
            description: event.status || '',
            location: event.location || undefined,
            timestamp: new Date(event.date || Date.now()),
          })),
        },
      };
    } catch (error: any) {
      console.error('[SHIPROCKET] Tracking error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch tracking status',
      };
    }
  }

  /**
   * Create shipment and get AWB number
   */
  async createShipment(shipmentData: any): Promise<CourierApiResponse<{ awbNumber: string; labelUrl?: string }>> {
    try {
      const token = await this.authenticate();

      const response = await this.api.post(
        '/orders/create/adhoc',
        {
          order_id: shipmentData.orderId,
          order_date: shipmentData.orderDate || new Date().toISOString(),
          pickup_location: shipmentData.pickupLocation,
          billing_customer_name: shipmentData.billingName,
          billing_last_name: shipmentData.billingLastName || '',
          billing_address: shipmentData.billingAddress,
          billing_city: shipmentData.billingCity,
          billing_pincode: shipmentData.billingPincode,
          billing_state: shipmentData.billingState,
          billing_country: shipmentData.billingCountry || 'India',
          billing_email: shipmentData.billingEmail,
          billing_phone: shipmentData.billingPhone,
          shipping_is_billing: shipmentData.shippingIsBilling || true,
          order_items: shipmentData.items,
          payment_method: shipmentData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
          sub_total: shipmentData.subtotal,
          length: shipmentData.dimensions?.length || 10,
          breadth: shipmentData.dimensions?.width || 10,
          height: shipmentData.dimensions?.height || 10,
          weight: shipmentData.weight,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        success: true,
        data: {
          awbNumber: response.data.shipment_id,
          labelUrl: response.data.label_url,
        },
      };
    } catch (error: any) {
      console.error('[SHIPROCKET] Create shipment error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create shipment',
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Map Shiprocket status to our standard format
   */
  private mapShiprocketStatus(trackingData: any): { status: string; statusCode: string; description: string } {
    const status = trackingData.current_status || '';
    const statusLower = status.toLowerCase();

    // Map to our order statuses
    if (statusLower.includes('delivered')) {
      return {
        status: 'delivered',
        statusCode: 'DELIVERED',
        description: 'Your order has been delivered',
      };
    } else if (statusLower.includes('out for delivery') || statusLower.includes('ofd')) {
      return {
        status: 'out_for_delivery',
        statusCode: 'OUT_FOR_DELIVERY',
        description: 'Your order is out for delivery',
      };
    } else if (statusLower.includes('shipped') || statusLower.includes('dispatched')) {
      return {
        status: 'shipped',
        statusCode: 'SHIPPED',
        description: 'Your order has been shipped',
      };
    } else if (statusLower.includes('in transit')) {
      return {
        status: 'shipped',
        statusCode: 'IN_TRANSIT',
        description: 'Your order is in transit',
      };
    } else {
      return {
        status: 'processing',
        statusCode: status.toUpperCase(),
        description: status || 'Order is being processed',
      };
    }
  }
}

