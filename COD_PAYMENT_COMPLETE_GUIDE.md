# Cash on Delivery (COD) Payment System - Complete Guide

## 🎯 Overview

This document provides a comprehensive guide to the Cash on Delivery (COD) payment system, including partial prepaid COD, delivery integration, payment switching, and refunds.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [COD Payment Flow](#cod-payment-flow)
3. [Partial Prepaid COD](#partial-prepaid-cod)
4. [Delivery Integration](#delivery-integration)
5. [Payment Method Switching](#payment-method-switching)
6. [COD Refunds](#cod-refunds)
7. [Fraud & Abuse Protection](#fraud--abuse-protection)
8. [API Reference](#api-reference)
9. [Testing](#testing)

---

## 🏗️ Architecture Overview

### COD Mental Model

```
COD Flow:
Reserve Inventory → Ship Order → Collect Payment → Consume Inventory
                                    ↓
                                  Fail → Release Inventory
```

### Key Principles

1. **COD is Delayed Payment** - Not unpaid payment
2. **Inventory Reserved Immediately** - Prevents overselling
3. **Payment Status Tracking** - `cod_pending` → `cod_collected` / `cod_failed`
4. **Abuse Protection** - Auto-blocks users after threshold failures
5. **Transactional Integrity** - All operations wrapped in MongoDB transactions

---

## 💰 COD Payment Flow

### Step 1: Place COD Order

```typescript
POST /api/orders/cod/place
{
  "items": [
    {
      "productId": "prod_123",
      "quantity": 2
    }
  ],
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  }
}

Response:
{
  "orderId": "order_123",
  "status": "pending",
  "paymentStatus": "cod_pending",
  "codAmount": 5000.00,
  "message": "Order placed successfully. Payment will be collected on delivery."
}
```

### Step 2: Ship Order

Order is shipped and delivery status is tracked.

### Step 3: Collect COD

```typescript
PATCH /api/orders/cod/:id/collect
{
  "collectedAmount": 5000.00,
  "notes": "Payment collected successfully"
}

Response:
{
  "message": "COD collected successfully"
}
```

**What Happens:**
- Order status → `paid`
- Payment status → `cod_collected`
- Inventory → Consumed
- Event → `order.paid` emitted

### Step 4: Handle COD Failure

```typescript
PATCH /api/orders/cod/:id/fail
{
  "reason": "Customer refused delivery"
}

Response:
{
  "message": "COD marked as failed"
}
```

**What Happens:**
- Order status → `cancelled`
- Payment status → `cod_failed`
- Inventory → Released
- User failure count → Incremented
- Event → `order.payment.failed` emitted

---

## 💳 Partial Prepaid COD

### Use Case

Allow customers to pay part online, rest on delivery. Useful for:
- Orders exceeding COD limit
- Building customer trust
- Reducing COD risk

### Create Partial Prepaid Order

```typescript
POST /api/orders/cod/partial-prepaid
{
  "items": [...],
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "shippingAddress": {...},
  "prepaidAmount": 2000.00,  // Pay online
  "onlinePaymentProvider": "stripe",  // or "paypal"
  "couponCode": "SAVE10"
}

Response (Stripe):
{
  "orderId": "order_123",
  "status": "pending",
  "paymentStatus": "cod_partial_paid",
  "prepaidAmount": 2000.00,
  "codAmount": 3000.00,  // Remaining on delivery
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "provider": "stripe"
}

Response (PayPal):
{
  "orderId": "order_123",
  "prepaidAmount": 2000.00,
  "codAmount": 3000.00,
  "approvalUrl": "https://www.paypal.com/checkoutnow?token=xxx",
  "paypalOrderId": "5O190127TN364715T",
  "provider": "paypal"
}
```

### Flow

1. **Create Order** → Status: `pending`, Payment: `cod_partial_paid`
2. **Complete Online Payment** → Webhook confirms prepaid amount
3. **Ship Order** → Delivery status tracked
4. **Collect COD** → Remaining amount collected on delivery

---

## 🚚 Delivery Integration

### Delivery Status Model

```typescript
{
  orderId: ObjectId,
  deliveryPartnerId: ObjectId,
  trackingNumber: string,
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned',
  currentLocation: string,
  estimatedDeliveryDate: Date,
  deliveredAt: Date
}
```

### Update Delivery Status (Webhook)

```typescript
POST /api/delivery/status/update
Headers:
  X-Partner-Code: FEDEX
  X-API-Key: your_api_key

Body:
{
  "orderId": "order_123",
  "status": "out_for_delivery",
  "trackingNumber": "1Z999AA10123456784",
  "currentLocation": "New York Distribution Center",
  "estimatedDeliveryDate": "2024-01-15T10:00:00Z"
}
```

### Get Delivery Status

```typescript
GET /api/delivery/status/:orderId

Response:
{
  "deliveryStatus": {
    "status": "out_for_delivery",
    "trackingNumber": "1Z999AA10123456784",
    "currentLocation": "New York Distribution Center",
    "estimatedDeliveryDate": "2024-01-15T10:00:00Z"
  }
}
```

### COD Collection Trigger

When delivery status becomes `delivered`:
- Event `order.delivered.cod_pending` is emitted
- System can trigger COD collection reminder
- Admin can mark COD as collected

---

## 🔄 Payment Method Switching

### Get Available Payment Methods

```typescript
GET /api/payments/switch/methods/:orderId

Response:
{
  "methods": [
    {
      "method": "stripe",
      "available": true,
      "metadata": {}
    },
    {
      "method": "paypal",
      "available": true,
      "metadata": {}
    },
    {
      "method": "cod",
      "available": true,
      "metadata": {
        "codLimit": 5000.00
      }
    },
    {
      "method": "cod_partial",
      "available": true,
      "metadata": {
        "codLimit": 5000.00,
        "requiresPrepaid": true
      }
    }
  ]
}
```

### Switch Payment Method

```typescript
POST /api/payments/switch/switch
{
  "orderId": "order_123",
  "newPaymentMethod": "cod",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "shippingAddress": {
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  }
}

Response:
{
  "message": "Payment method switched successfully"
}
```

**Supported Switches:**
- Online → COD
- COD → Online
- Online → Partial Prepaid COD
- Partial Prepaid COD → Full COD

---

## 💸 COD Refunds

### Create COD Refund

```typescript
POST /api/orders/cod/refunds/create
{
  "orderId": "order_123",
  "refundType": "full",  // or "partial"
  "reason": "Customer returned product",
  "amount": 5000.00,  // Required for partial
  "items": [  // Required for partial
    {
      "productId": "prod_123",
      "quantity": 1
    }
  ]
}

Response:
{
  "refundId": "refund_123",
  "amount": 5000.00,
  "status": "succeeded",
  "inventoryRestored": true
}
```

### Get COD Refunds

```typescript
GET /api/orders/cod/refunds/:orderId

Response:
{
  "refunds": [
    {
      "refundId": "refund_123",
      "refundType": "full",
      "amount": 5000.00,
      "status": "succeeded",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Refund Features:**
- ✅ Full and partial refunds
- ✅ Automatic inventory restoration
- ✅ Immediate processing (no provider refund needed)
- ✅ Audit logging

---

## 🛡️ Fraud & Abuse Protection

### COD Eligibility Rules

1. **Order Value Limit** - Default: ₹5000 (configurable)
2. **User Failure Count** - Block after 3 failures
3. **Cancellation Rate** - Block if >50% cancelled
4. **Store Status** - Store must be active
5. **Address Completeness** - Complete shipping address required

### Auto-Blocking

Users are automatically blocked when:
- COD failure count ≥ 3
- COD cancellation rate ≥ 50%

### Track User Flags

```typescript
// CODUserFlag Model
{
  userId: string,
  storeId: ObjectId,
  codFailureCount: number,
  codCancellationRate: number,
  isBlocked: boolean,
  blockedAt: Date,
  blockedReason: string
}
```

---

## 📚 API Reference

### COD Order Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/orders/cod/place` | POST | Place COD order | ✅ |
| `/api/orders/cod/partial-prepaid` | POST | Create partial prepaid COD | ✅ |
| `/api/orders/cod/:id/collect` | PATCH | Mark COD collected | ✅ |
| `/api/orders/cod/:id/fail` | PATCH | Mark COD failed | ✅ |

### COD Refund Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/orders/cod/refunds/create` | POST | Create COD refund | ✅ |
| `/api/orders/cod/refunds/:orderId` | GET | Get COD refunds | ✅ |

### Delivery Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/delivery/status/update` | POST | Update delivery status (webhook) | ❌ (API Key) |
| `/api/delivery/status/:orderId` | GET | Get delivery status | ✅ |

### Payment Switch Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/payments/switch/methods/:orderId` | GET | Get available methods | ✅ |
| `/api/payments/switch/switch` | POST | Switch payment method | ✅ |

---

## 🧪 Testing

### Test Scenarios

1. **Eligible COD Order**
   - Place COD order
   - Verify inventory reserved
   - Collect COD
   - Verify inventory consumed

2. **Ineligible COD (Over Limit)**
   - Try to place COD order > limit
   - Verify order rejected

3. **Partial Prepaid COD**
   - Create partial prepaid order
   - Complete online payment
   - Collect remaining COD
   - Verify both amounts tracked

4. **COD Failure**
   - Place COD order
   - Mark as failed
   - Verify inventory released
   - Verify user failure count incremented

5. **Abuse Threshold**
   - Place 3 COD orders
   - Fail all 3
   - Try to place 4th COD order
   - Verify blocked

6. **Delivery Integration**
   - Update delivery status
   - Verify COD collection trigger
   - Verify event emitted

7. **Payment Method Switch**
   - Get available methods
   - Switch from online to COD
   - Verify order updated

8. **COD Refund**
   - Create COD refund
   - Verify inventory restored
   - Verify refund tracked

---

## 🔧 Environment Variables

```env
COD_LIMIT=500000  # Max COD amount in cents (default: 5000.00)
COD_FAILURE_THRESHOLD=3  # Block after N failures
COD_CANCELLATION_THRESHOLD=50  # Block if cancellation rate > N%
```

---

## 📊 Models

### Order (COD Fields)

```typescript
{
  paymentMethod: 'cod' | 'cod_partial',
  paymentStatus: 'cod_pending' | 'cod_collected' | 'cod_failed' | 'cod_partial_paid',
  codAmount: number,  // Remaining COD amount
  prepaidAmount?: number,  // Prepaid amount (for partial)
  codEligible: boolean,
  codConfirmedAt?: Date
}
```

### COD User Flag

```typescript
{
  userId: string,
  storeId: ObjectId,
  codFailureCount: number,
  codCancellationRate: number,
  isBlocked: boolean,
  blockedAt?: Date,
  blockedReason?: string
}
```

### Delivery Status

```typescript
{
  orderId: ObjectId,
  deliveryPartnerId?: ObjectId,
  trackingNumber?: string,
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned',
  currentLocation?: string,
  estimatedDeliveryDate?: Date,
  deliveredAt?: Date
}
```

---

## 🎓 Key Takeaways

1. **COD = Delayed Payment** - Never mark as paid at checkout
2. **Inventory Reserved Immediately** - Prevents overselling
3. **Abuse Protection** - Auto-blocks after threshold
4. **Partial Prepaid** - Reduces risk for high-value orders
5. **Delivery Integration** - Triggers COD collection on delivery
6. **Payment Switching** - Flexible payment method changes
7. **Refund Support** - Full and partial COD refunds

---

## 🔗 Related Documentation

- [Payment Integration Guide](./PAYMENT_INTEGRATION_COMPLETE.md)
- [Inventory Reservation System](./INVENTORY_RESERVATION_GUIDE.md)
- [Audit Logging](./AUDIT_LOGGING_GUIDE.md)

---

**Last Updated**: 2024
**Version**: 1.0.0

