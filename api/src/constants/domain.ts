// Centralized domain constants to prevent string drift

export const Roles = {
  ADMIN: 'admin',
  SUPPLIER: 'supplier',
  RESELLER: 'reseller',
  SYSTEM: 'system',
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];

export const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  COD: 'cod',
  COD_PARTIAL: 'cod_partial',
} as const;
export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  COD_PENDING: 'cod_pending',
  COD_COLLECTED: 'cod_collected',
  COD_FAILED: 'cod_failed',
  COD_PARTIAL_PAID: 'cod_partial_paid',
} as const;
export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const SubscriptionStatus = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;
export type SubscriptionStatusType = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PricingScopes = {
  GLOBAL: 'global',
  CATEGORY: 'category',
  PRODUCT: 'product',
  VARIANT: 'variant',
} as const;
export type PricingScopeType = (typeof PricingScopes)[keyof typeof PricingScopes];

export const AuditActions = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  ORDER_CREATED: 'ORDER_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PRICE_RULE_UPDATED: 'PRICE_RULE_UPDATED',
  STORE_CREATED: 'STORE_CREATED',
  STORE_SUSPENDED: 'STORE_SUSPENDED',
  STORE_ACTIVATED: 'STORE_ACTIVATED',
  IP_RULE_CREATED: 'IP_RULE_CREATED',
  IP_RULE_UPDATED: 'IP_RULE_UPDATED',
  IP_RULE_DISABLED: 'IP_RULE_DISABLED',
  TEMPLATE_CREATED: 'TEMPLATE_CREATED',
  TEMPLATE_APPLIED: 'TEMPLATE_APPLIED',
  TEMPLATE_VERSIONED: 'TEMPLATE_VERSIONED',
  STORE_TEMPLATE_FAILED: 'STORE_TEMPLATE_FAILED',
  BRANDING_CREATED: 'BRANDING_CREATED',
  BRANDING_UPDATED: 'BRANDING_UPDATED',
  BRANDING_ROLLED_BACK: 'BRANDING_ROLLED_BACK',
  THEME_CHANGED: 'THEME_CHANGED',
  THEME_APPLIED: 'THEME_APPLIED',
  THEME_ROLLED_BACK: 'THEME_ROLLED_BACK',
  COD_ORDER_PLACED: 'COD_ORDER_PLACED',
  COD_COLLECTED: 'COD_COLLECTED',
  COD_FAILED: 'COD_FAILED',
  COD_USER_BLOCKED: 'COD_USER_BLOCKED',
} as const;
export type AuditActionType = (typeof AuditActions)[keyof typeof AuditActions];

export const SecurityEventTypes = {
  IP_BLOCKED: 'IP_BLOCKED',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
} as const;
export type SecurityEventType = (typeof SecurityEventTypes)[keyof typeof SecurityEventTypes];


