/**
 * WhatsApp Template Registry
 *
 * PURPOSE:
 * - Map order lifecycle events to WhatsApp templates
 * - Define required template variables
 * - Ensure templates are approved in WhatsApp Business Manager
 *
 * RULES:
 * - Template names must exist in WhatsApp Business Manager
 * - No dynamic free-text allowed
 * - All templates must be pre-approved
 */

export type WhatsAppAudience = 'customer' | 'supplier' | 'reseller';

export type OrderLifecycleEvent =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_SHIPPED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_READY_TO_SHIP';

export interface WhatsAppTemplateConfig {
  audience: WhatsAppAudience;
  templateName: string;
  variables: string[]; // Required template variables
  description?: string;
}

/**
 * Template registry mapping events to WhatsApp templates
 */
export const WHATSAPP_TEMPLATE_REGISTRY: Record<OrderLifecycleEvent, WhatsAppTemplateConfig[]> = {
  // Customer notifications
  ORDER_PLACED: [
    {
      audience: 'customer',
      templateName: 'order_placed_v1',
      variables: ['name', 'orderNumber', 'amount'],
      description: 'Sent when customer places an order',
    },
  ],
  ORDER_CONFIRMED: [
    {
      audience: 'customer',
      templateName: 'order_confirmed_v1',
      variables: ['name', 'orderNumber', 'amount'],
      description: 'Sent when order is confirmed',
    },
    {
      audience: 'reseller',
      templateName: 'order_confirmed_reseller_v1',
      variables: ['orderNumber', 'amount', 'marginEarned'],
      description: 'Sent to reseller when order is confirmed',
    },
  ],
  ORDER_SHIPPED: [
    {
      audience: 'customer',
      templateName: 'order_shipped_v1',
      variables: ['name', 'orderNumber', 'trackingLink', 'courierName'],
      description: 'Sent when order is shipped',
    },
  ],
  ORDER_OUT_FOR_DELIVERY: [
    {
      audience: 'customer',
      templateName: 'order_out_for_delivery_v1',
      variables: ['name', 'orderNumber', 'trackingLink', 'courierName'],
      description: 'Sent when order is out for delivery',
    },
  ],
  ORDER_DELIVERED: [
    {
      audience: 'customer',
      templateName: 'order_delivered_v1',
      variables: ['name', 'orderNumber'],
      description: 'Sent when order is delivered',
    },
    {
      audience: 'reseller',
      templateName: 'order_delivered_reseller_v1',
      variables: ['orderNumber', 'amount'],
      description: 'Sent to reseller when order is delivered',
    },
  ],
  ORDER_CANCELLED: [
    {
      audience: 'customer',
      templateName: 'order_cancelled_v1',
      variables: ['name', 'orderNumber', 'refundAmount'],
      description: 'Sent when order is cancelled',
    },
  ],
  ORDER_REFUNDED: [
    {
      audience: 'customer',
      templateName: 'order_refunded_v1',
      variables: ['name', 'orderNumber', 'refundAmount'],
      description: 'Sent when order is refunded',
    },
  ],

  // Supplier notifications
  ORDER_ASSIGNED: [
    {
      audience: 'supplier',
      templateName: 'order_assigned_v1',
      variables: ['orderNumber', 'itemCount', 'pickupAddress'],
      description: 'Sent to supplier when order is assigned',
    },
  ],
  ORDER_READY_TO_SHIP: [
    {
      audience: 'supplier',
      templateName: 'order_ready_to_ship_v1',
      variables: ['orderNumber', 'labelLink', 'pickupAddress'],
      description: 'Sent to supplier when order is ready to ship',
    },
  ],
};

/**
 * Get template config for an event and audience
 */
export function getWhatsAppTemplate(
  eventType: OrderLifecycleEvent,
  audience: WhatsAppAudience
): WhatsAppTemplateConfig | null {
  const templates = WHATSAPP_TEMPLATE_REGISTRY[eventType];
  if (!templates) {
    return null;
  }

  return templates.find((t) => t.audience === audience) || null;
}

/**
 * Get all templates for an event
 */
export function getWhatsAppTemplatesForEvent(
  eventType: OrderLifecycleEvent
): WhatsAppTemplateConfig[] {
  return WHATSAPP_TEMPLATE_REGISTRY[eventType] || [];
}

