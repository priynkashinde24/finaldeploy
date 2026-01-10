/**
 * Order Status Constants
 * 
 * PURPOSE:
 * - Single source of truth for order status values
 * - Type-safe status enums
 * - Used by state machine and lifecycle engine
 * 
 * RULES:
 * - Status can move ONLY via lifecycle engine
 * - No direct updates from controllers
 */

export enum OrderStatus {
  CREATED = 'created',
  PAYMENT_PENDING = 'payment_pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
}

export type OrderStatusType = OrderStatus | string;

/**
 * Order status display names
 */
export const OrderStatusDisplayNames: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'Created',
  [OrderStatus.PAYMENT_PENDING]: 'Payment Pending',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.SHIPPED]: 'Shipped',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.RETURNED]: 'Returned',
  [OrderStatus.REFUNDED]: 'Refunded',
};

/**
 * Check if status is terminal (no further transitions allowed)
 */
export function isTerminalStatus(status: OrderStatusType): boolean {
  return [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ].includes(status as OrderStatus);
}

/**
 * Check if order can be cancelled from current status
 */
export function canCancelFromStatus(status: OrderStatusType): boolean {
  return [
    OrderStatus.CREATED,
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
  ].includes(status as OrderStatus);
}

/**
 * Check if order can be returned from current status
 */
export function canReturnFromStatus(status: OrderStatusType): boolean {
  return status === OrderStatus.DELIVERED;
}

