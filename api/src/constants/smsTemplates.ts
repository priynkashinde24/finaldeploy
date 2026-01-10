/**
 * SMS Template Registry
 *
 * PURPOSE:
 * - Map order lifecycle events to SMS templates
 * - Define required template variables
 * - Plain text templates (≤160 chars preferred)
 *
 * RULES:
 * - Plain text only (no rich formatting)
 * - ≤160 characters preferred (single SMS)
 * - No marketing content (transactional only)
 * - Use {{variable}} placeholders
 */

export type SMSAudience = 'customer' | 'supplier' | 'reseller';

export type OrderLifecycleEvent =
  | 'ORDER_CONFIRMED'
  | 'ORDER_SHIPPED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED';

export interface SMSTemplateConfig {
  audience: SMSAudience;
  template: string; // Plain text template with {{variable}} placeholders
  variables: string[]; // Required template variables
  description?: string;
}

/**
 * Template registry mapping events to SMS templates
 */
export const SMS_TEMPLATE_REGISTRY: Record<OrderLifecycleEvent, SMSTemplateConfig[]> = {
  ORDER_CONFIRMED: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, your order {{orderNumber}} is confirmed. Amount: ₹{{amount}}. Track: {{trackingLink}}',
      variables: ['name', 'orderNumber', 'amount', 'trackingLink'],
      description: 'Sent when order is confirmed',
    },
    {
      audience: 'reseller',
      template: 'Order {{orderNumber}} confirmed. Amount: ₹{{amount}}. Margin: ₹{{marginEarned}}',
      variables: ['orderNumber', 'amount', 'marginEarned'],
      description: 'Sent to reseller when order is confirmed',
    },
  ],
  ORDER_SHIPPED: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, your order {{orderNumber}} has been shipped via {{courierName}}. Track: {{trackingLink}}',
      variables: ['name', 'orderNumber', 'courierName', 'trackingLink'],
      description: 'Sent when order is shipped',
    },
  ],
  ORDER_OUT_FOR_DELIVERY: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, your order {{orderNumber}} is out for delivery via {{courierName}}. Track: {{trackingLink}}',
      variables: ['name', 'orderNumber', 'courierName', 'trackingLink'],
      description: 'Sent when order is out for delivery',
    },
  ],
  ORDER_DELIVERED: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, your order {{orderNumber}} has been delivered. Thank you for shopping with us!',
      variables: ['name', 'orderNumber'],
      description: 'Sent when order is delivered',
    },
    {
      audience: 'reseller',
      template: 'Order {{orderNumber}} delivered. Amount: ₹{{amount}}',
      variables: ['orderNumber', 'amount'],
      description: 'Sent to reseller when order is delivered',
    },
  ],
  ORDER_CANCELLED: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, your order {{orderNumber}} has been cancelled. Refund: ₹{{refundAmount}}',
      variables: ['name', 'orderNumber', 'refundAmount'],
      description: 'Sent when order is cancelled',
    },
  ],
  ORDER_REFUNDED: [
    {
      audience: 'customer',
      template: 'Hi {{name}}, refund of ₹{{refundAmount}} for order {{orderNumber}} has been processed.',
      variables: ['name', 'orderNumber', 'refundAmount'],
      description: 'Sent when order is refunded',
    },
  ],
};

/**
 * Get template config for an event and audience
 */
export function getSMSTemplate(
  eventType: OrderLifecycleEvent,
  audience: SMSAudience
): SMSTemplateConfig | null {
  const templates = SMS_TEMPLATE_REGISTRY[eventType];
  if (!templates) {
    return null;
  }

  return templates.find((t) => t.audience === audience) || null;
}

/**
 * Get all templates for an event
 */
export function getSMSTemplatesForEvent(
  eventType: OrderLifecycleEvent
): SMSTemplateConfig[] {
  return SMS_TEMPLATE_REGISTRY[eventType] || [];
}

/**
 * Replace template variables with actual values
 */
export function renderSMSTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, value || '');
  }
  return rendered;
}

