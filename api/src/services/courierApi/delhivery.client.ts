import axios, { AxiosInstance } from 'axios';
import { CourierApiClient, CourierApiResponse, CourierTrackingStatus, CourierApiConfig } from './courierApi.types';
import crypto from 'crypto';

/**
 * Delhivery API Client
 * 
 * PURPOSE:
 * - Integrate with Delhivery API
 * - Get real-time tracking updates
 * - Create shipments
 * - Handle webhooks
 * 
 * DOCS: https://delhivery.com/api-docs
 */

export class DelhiveryClient implements CourierApiClient {
  private api: AxiosInstance;
  private config: CourierApiConfig;

  constructor(config: CourierApiConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: config.baseUrl || 'https://track.delhivery.com/api/v1/packages/json',
      headers: {
        'Authorization': `Token ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get tracking status for an AWB number
   */
  async getTrackingStatus(awbNumber: string): Promise<CourierApiResponse<CourierTrackingStatus>> {
    try {
      const response = await this.api.get('', {
        params: {
          waybill: awbNumber,
        },
      });

      const trackingData = response.data?.ShipmentData?.[0];
      if (!trackingData) {
        return {
          success: false,
          error: 'No tracking data found',
        };
      }

      // Map Delhivery status to our format
      const status = this.mapDelhiveryStatus(trackingData);

      return {
        success: true,
        data: {
          awbNumber,
          status: status.status,
          statusCode: status.statusCode,
          statusDescription: status.description,
          location: trackingData.CurrentStatus?.Location || undefined,
          timestamp: new Date(trackingData.CurrentStatus?.StatusDateTime || Date.now()),
          estimatedDelivery: trackingData.ExpectedDeliveryDate
            ? new Date(trackingData.ExpectedDeliveryDate)
            : undefined,
          currentLocation: trackingData.CurrentStatus?.Location
            ? {
                city: trackingData.CurrentStatus.Location.split(',')[0],
                state: trackingData.CurrentStatus.Location.split(',')[1],
              }
            : undefined,
          events: (trackingData.Scan || []).map((scan: any) => ({
            status: scan.Status || '',
            description: scan.Status || '',
            location: scan.Location || undefined,
            timestamp: new Date(scan.StatusDateTime || Date.now()),
          })),
        },
      };
    } catch (error: any) {
      console.error('[DELHIVERY] Tracking error:', error);
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
      const response = await axios.post(
        'https://staging-express.delhivery.com/api/cmu/create.json',
        {
          format: 'json',
          data: JSON.stringify({
            shipments: [
              {
                name: shipmentData.billingName,
                add: shipmentData.billingAddress,
                pin: shipmentData.billingPincode,
                phone: shipmentData.billingPhone,
                payment_mode: shipmentData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
                amount: shipmentData.subtotal,
                order: shipmentData.orderId,
                products_desc: shipmentData.itemsDescription,
                quantity: shipmentData.itemsQuantity || 1,
                weight: shipmentData.weight,
              },
            ],
            pick_location: shipmentData.pickupLocation,
          }),
        },
        {
          headers: {
            'Authorization': `Token ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const shipment = response.data?.packages?.[0];
      if (!shipment) {
        return {
          success: false,
          error: 'Failed to create shipment',
        };
      }

      return {
        success: true,
        data: {
          awbNumber: shipment.waybill,
          labelUrl: shipment.label,
        },
      };
    } catch (error: any) {
      console.error('[DELHIVERY] Create shipment error:', error);
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
   * Map Delhivery status to our standard format
   */
  private mapDelhiveryStatus(trackingData: any): { status: string; statusCode: string; description: string } {
    const status = trackingData.CurrentStatus?.Status || '';
    const statusLower = status.toLowerCase();

    // Map to our order statuses
    if (statusLower.includes('delivered') || statusLower.includes('dl')) {
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
    } else if (statusLower.includes('dispatched') || statusLower.includes('in transit')) {
      return {
        status: 'shipped',
        statusCode: 'SHIPPED',
        description: 'Your order has been shipped',
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

