import { OrderStatus, OrderStatusType, canCancelFromStatus, canReturnFromStatus } from '../constants/orderStatus';

/**
 * Order State Machine
 * 
 * PURPOSE:
 * - Define valid order status transitions
 * - Enforce state machine rules
 * - Prevent invalid transitions
 * 
 * RULES:
 * - Only defined transitions are allowed
 * - Invalid transitions throw errors
 * - Terminal states cannot transition
 */

export interface StateTransition {
  from: OrderStatusType;
  to: OrderStatusType;
  allowed: boolean;
  requiresRole?: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system';
  sideEffects?: string[];
}

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Map<string, StateTransition> = new Map([
  // Initial flow
  [`${OrderStatus.CREATED}→${OrderStatus.PAYMENT_PENDING}`, {
    from: OrderStatus.CREATED,
    to: OrderStatus.PAYMENT_PENDING,
    allowed: true,
    requiresRole: 'system',
    sideEffects: ['reserve_inventory'],
  }],
  
  [`${OrderStatus.PAYMENT_PENDING}→${OrderStatus.CONFIRMED}`, {
    from: OrderStatus.PAYMENT_PENDING,
    to: OrderStatus.CONFIRMED,
    allowed: true,
    requiresRole: 'system',
    sideEffects: ['consume_inventory', 'generate_invoices', 'lock_payment_split'],
  }],
  
  // Processing flow
  [`${OrderStatus.CONFIRMED}→${OrderStatus.PROCESSING}`, {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.PROCESSING,
    allowed: true,
    requiresRole: 'supplier',
    sideEffects: ['notify_supplier'],
  }],
  
  [`${OrderStatus.PROCESSING}→${OrderStatus.SHIPPED}`, {
    from: OrderStatus.PROCESSING,
    to: OrderStatus.SHIPPED,
    allowed: true,
    requiresRole: 'supplier',
    sideEffects: ['attach_tracking', 'notify_customer'],
  }],
  
  // Delivery flow
  [`${OrderStatus.SHIPPED}→${OrderStatus.OUT_FOR_DELIVERY}`, {
    from: OrderStatus.SHIPPED,
    to: OrderStatus.OUT_FOR_DELIVERY,
    allowed: true,
    requiresRole: 'delivery',
    sideEffects: ['notify_customer'],
  }],
  
  [`${OrderStatus.OUT_FOR_DELIVERY}→${OrderStatus.DELIVERED}`, {
    from: OrderStatus.OUT_FOR_DELIVERY,
    to: OrderStatus.DELIVERED,
    allowed: true,
    requiresRole: 'delivery',
    sideEffects: ['mark_payout_eligible', 'start_return_window'],
  }],
  
  // Cancellation (can cancel before shipped)
  [`${OrderStatus.CREATED}→${OrderStatus.CANCELLED}`, {
    from: OrderStatus.CREATED,
    to: OrderStatus.CANCELLED,
    allowed: true,
    requiresRole: 'customer',
    sideEffects: ['release_inventory'],
  }],
  
  [`${OrderStatus.PAYMENT_PENDING}→${OrderStatus.CANCELLED}`, {
    from: OrderStatus.PAYMENT_PENDING,
    to: OrderStatus.CANCELLED,
    allowed: true,
    requiresRole: 'customer',
    sideEffects: ['release_inventory'],
  }],
  
  [`${OrderStatus.CONFIRMED}→${OrderStatus.CANCELLED}`, {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.CANCELLED,
    allowed: true,
    requiresRole: 'admin',
    sideEffects: ['reverse_payment', 'release_inventory'],
  }],
  
  [`${OrderStatus.PROCESSING}→${OrderStatus.CANCELLED}`, {
    from: OrderStatus.PROCESSING,
    to: OrderStatus.CANCELLED,
    allowed: true,
    requiresRole: 'admin',
    sideEffects: ['reverse_payment', 'release_inventory'],
  }],
  
  // Return flow
  [`${OrderStatus.DELIVERED}→${OrderStatus.RETURNED}`, {
    from: OrderStatus.DELIVERED,
    to: OrderStatus.RETURNED,
    allowed: true,
    requiresRole: 'customer',
    sideEffects: ['reserve_returned_inventory', 'start_refund_process'],
  }],
  
  [`${OrderStatus.RETURNED}→${OrderStatus.REFUNDED}`, {
    from: OrderStatus.RETURNED,
    to: OrderStatus.REFUNDED,
    allowed: true,
    requiresRole: 'admin',
    sideEffects: ['generate_credit_note', 'reverse_payout_ledger'],
  }],
  
  // Admin can transition to any state (for corrections)
  [`${OrderStatus.CONFIRMED}→${OrderStatus.SHIPPED}`, {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.SHIPPED,
    allowed: true,
    requiresRole: 'admin',
    sideEffects: ['attach_tracking', 'notify_customer'],
  }],
]);

/**
 * Check if transition is allowed
 */
export function isTransitionAllowed(
  from: OrderStatusType,
  to: OrderStatusType,
  actorRole: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system' = 'system'
): { allowed: boolean; transition?: StateTransition; error?: string } {
  // Same status = no-op (allowed but no side effects)
  if (from === to) {
    return { allowed: true };
  }
  
  // Check if transition exists
  const transitionKey = `${from}→${to}`;
  const transition = VALID_TRANSITIONS.get(transitionKey);
  
  if (!transition) {
    return {
      allowed: false,
      error: `Invalid transition from ${from} to ${to}`,
    };
  }
  
  // Check role permission
  if (transition.requiresRole && actorRole !== 'admin') {
    if (transition.requiresRole !== actorRole) {
      return {
        allowed: false,
        error: `Role ${actorRole} is not allowed to transition from ${from} to ${to}. Required role: ${transition.requiresRole}`,
      };
    }
  }
  
  return {
    allowed: true,
    transition,
  };
}

/**
 * Get all allowed transitions from a status
 */
export function getAllowedTransitions(
  from: OrderStatusType,
  actorRole: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system' = 'system'
): OrderStatusType[] {
  const allowed: OrderStatusType[] = [];
  
  for (const [key, transition] of VALID_TRANSITIONS.entries()) {
    if (transition.from === from) {
      // Check role permission
      if (transition.requiresRole && actorRole !== 'admin') {
        if (transition.requiresRole === actorRole) {
          allowed.push(transition.to);
        }
      } else {
        // Admin or no role requirement
        allowed.push(transition.to);
      }
    }
  }
  
  // Special cases: cancellation and return
  if (canCancelFromStatus(from) && (actorRole === 'customer' || actorRole === 'admin')) {
    if (!allowed.includes(OrderStatus.CANCELLED)) {
      allowed.push(OrderStatus.CANCELLED);
    }
  }
  
  if (canReturnFromStatus(from) && (actorRole === 'customer' || actorRole === 'admin')) {
    if (!allowed.includes(OrderStatus.RETURNED)) {
      allowed.push(OrderStatus.RETURNED);
    }
  }
  
  return allowed;
}

/**
 * Get transition details
 */
export function getTransitionDetails(
  from: OrderStatusType,
  to: OrderStatusType
): StateTransition | null {
  const transitionKey = `${from}→${to}`;
  return VALID_TRANSITIONS.get(transitionKey) || null;
}

