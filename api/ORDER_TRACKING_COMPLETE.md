# Order Tracking System - Complete Guide

## 🎯 Overview

The Order Tracking system provides customers with real-time order status visibility, a clear lifecycle timeline, and integrated courier tracking information. The system is secure, multi-tenant safe, and supports both manual and API-based couriers.

---

## ✅ Architecture

### Tracking Data Flow

```
Order Number
  → Validate viewer access
  → Fetch order data
  → Build timeline from status history
  → Resolve courier tracking URL
  → Aggregate tracking data
  → Return to frontend
```

### Access Control

- **Customer**: Only own orders
- **Reseller**: Only own store orders
- **Admin**: All orders
- **Public**: With email/phone verification (optional)

---

## 📊 Data Models

### OrderStatusHistory
```typescript
{
  orderId: ObjectId,
  storeId: ObjectId,
  fromStatus: string,
  toStatus: string,
  actorRole: 'admin' | 'supplier' | 'delivery' | 'customer' | 'system',
  actorId?: ObjectId,
  timestamp: Date,
  metadata?: {
    reason?, trackingNumber?, notes?, returnReason?
  }
}
```

**Purpose**: Track all order status transitions for timeline rendering

**Auto-populated**: Created automatically when order status changes via `orderLifecycle.service.ts`

### Courier (Enhanced)
```typescript
{
  trackingUrlTemplate?: string  // e.g., "https://track.delhivery.com/{{awb}}"
}
```

**Purpose**: Resolve courier tracking URLs dynamically

---

## 🔧 API Endpoints

### Authenticated Tracking
**GET** `/api/orders/:orderNumber/track`

**Access**: Requires authentication (customer/reseller/admin)

**Response**:
```json
{
  "success": true,
  "data": {
    "orderNumber": "ORD-ABC-2024-0001",
    "orderStatus": "shipped",
    "paymentMethod": "stripe",
    "paymentStatus": "paid",
    "timeline": [
      {
        "status": "created",
        "label": "Order Placed",
        "description": "Your order has been placed successfully",
        "timestamp": "2024-01-15T10:00:00Z",
        "isCompleted": true,
        "isCurrent": false
      },
      {
        "status": "shipped",
        "label": "Shipped",
        "description": "Your order has been shipped",
        "timestamp": "2024-01-16T14:30:00Z",
        "isCompleted": false,
        "isCurrent": true
      }
    ],
    "courier": {
      "name": "Delhivery",
      "awbNumber": "DEL123456789",
      "trackingUrl": "https://track.delhivery.com/DEL123456789"
    },
    "shippingAddress": {
      "name": "John Doe",
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip": "400001",
      "country": "India"
    },
    "items": [
      {
        "productName": "Product Name",
        "variant": "Size: M",
        "quantity": 2,
        "imageUrl": "https://..."
      }
    ],
    "expectedDeliveryDate": "2024-01-20T00:00:00Z",
    "grandTotal": 1500.00,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### Public Tracking
**GET** `/api/orders/:orderNumber/track/public?email=...&phone=...`

**Access**: Public (rate limited: 10 requests per 15 minutes)

**Query Parameters**:
- `email`: Customer email (required if no phone)
- `phone`: Customer phone (required if no email)

**Response**: Same as authenticated tracking

---

## 🎨 Frontend Page

### Route
`/track/[orderNumber]`

### Components

1. **Order Summary Card**
   - Order status
   - Payment method
   - Total amount

2. **Timeline Component**
   - Vertical timeline with status indicators
   - Completed (green), Current (red), Upcoming (gray)
   - Status labels and descriptions
   - Timestamps

3. **Courier & Tracking Section**
   - Courier name
   - AWB/Tracking number
   - Tracking URL (if available)
   - Expected delivery date

4. **Shipping Address**
   - Full delivery address
   - Masked for public tracking

5. **Order Items**
   - Product names
   - Variants
   - Quantities
   - Product images

---

## 📋 Status Timeline Mapping

| Status | Label | Description |
|--------|-------|-------------|
| `created` | Order Placed | Your order has been placed successfully |
| `payment_pending` | Payment Pending | Waiting for payment confirmation |
| `confirmed` | Order Confirmed | Order confirmed and payment received |
| `processing` | Preparing Shipment | Your order is being prepared for shipment |
| `shipped` | Shipped | Your order has been shipped |
| `out_for_delivery` | Out for Delivery | Your order is out for delivery |
| `delivered` | Delivered | Your order has been delivered |
| `cancelled` | Cancelled | Your order has been cancelled |
| `returned` | Returned | Your order has been returned |
| `refunded` | Refunded | Your order has been refunded |

---

## 🔄 Courier Tracking URL Resolution

### Logic

1. **Check for AWB Number**:
   - From `ShippingLabel.awbNumber` (preferred)
   - From `Order.metadata.trackingNumber` (fallback)

2. **Resolve Tracking URL**:
   - If courier has `trackingUrlTemplate`:
     - Replace `{{awb}}` with AWB number
     - Return full URL
   - Else:
     - Return `null` (show "Tracking updates coming soon")

### Example

**Courier Configuration**:
```json
{
  "name": "Delhivery",
  "trackingUrlTemplate": "https://track.delhivery.com/{{awb}}"
}
```

**AWB Number**: `DEL123456789`

**Resolved URL**: `https://track.delhivery.com/DEL123456789`

---

## 🛡️ Security & Multi-Tenancy

### Access Validation

1. **Customer Access**:
   - Verify `order.customerId === viewer.userId`
   - Block if not match

2. **Reseller Access**:
   - Verify `order.storeId === viewer.storeId`
   - Block if not match

3. **Admin Access**:
   - Full access (no validation)

4. **Public Access**:
   - Verify `order.customerEmail === viewer.email` OR `order.customerPhone === viewer.phone`
   - Mask sensitive data (name, address)

### Data Masking (Public)

- Customer name: `***`
- Phone/Email: Not exposed
- Address: Full address shown (can be masked if needed)

### Rate Limiting

- **Public endpoint**: 10 requests per 15 minutes per IP
- **Authenticated endpoint**: No rate limit (relies on auth)

---

## 📊 Audit Logging

### Events Logged

**ORDER_TRACK_VIEWED**
- `orderId`: Order number
- `viewerType`: customer | reseller | admin | public
- `IP`: Viewer IP address
- `timestamp`: View timestamp

**Logged in**: `orderTracking.controller.ts`

---

## 🔍 Error Handling

### Error States

1. **Order Not Found**:
   - Status: `404`
   - Message: "Order not found"

2. **Access Denied**:
   - Status: `403`
   - Message: "Access denied: Not your order"

3. **Invalid Order Number**:
   - Status: `400`
   - Message: "Invalid order number format"

4. **Public Tracking Missing Email/Phone**:
   - Status: `400`
   - Message: "Email or phone required for public tracking"

### Frontend Error UI

- Error icon
- Clear error message
- "Try Again" button
- Loading states

---

## 🚀 Usage Examples

### Customer Views Own Order
```
GET /api/orders/ORD-ABC-2024-0001/track
Authorization: Bearer <customer_token>

✅ Access granted
✅ Timeline shown
✅ Full order details
```

### Reseller Views Store Order
```
GET /api/orders/ORD-ABC-2024-0001/track
Authorization: Bearer <reseller_token>
Store-Id: <store_id>

✅ Access granted (if order belongs to store)
❌ Access denied (if order from different store)
```

### Public Tracking
```
GET /api/orders/ORD-ABC-2024-0001/track/public?email=customer@example.com

✅ Access granted (if email matches)
✅ Timeline shown
✅ Masked customer name
```

---

## 🔄 Integration Points

### Order Lifecycle Service
- **Auto-populates** `OrderStatusHistory` on every status transition
- **No manual intervention** required

### Shipping Label System
- **Provides AWB number** for tracking URL resolution
- **Courier information** from `courierSnapshot`

### Courier System
- **Tracking URL templates** configured per courier
- **Supports manual and API couriers**

---

## 🎯 Best Practices

1. **Status History**: Always created automatically (no manual creation)
2. **Timeline Accuracy**: Derived from status history (never from order.currentStatus)
3. **Tracking URLs**: Configure templates for all active couriers
4. **Public Tracking**: Enable only if needed, with rate limiting
5. **Error Messages**: Clear and user-friendly
6. **Performance**: Index `orderId` and `timestamp` for fast queries

---

## ❌ Common Mistakes (Avoided)

✅ **Not tracking history** - Auto-populated on every transition
✅ **Not validating access** - Strict multi-tenant validation
✅ **Not masking public data** - Sensitive data masked for public
✅ **Not rate limiting** - Public endpoint rate limited
✅ **Not resolving tracking URLs** - Dynamic URL resolution

---

## 🚀 Future Enhancements

1. **Real-time Updates**: WebSocket/SSE for live status updates
2. **SMS Notifications**: Send tracking updates via SMS
3. **Email Tracking Links**: Direct links in order confirmation emails
4. **Estimated Delivery**: More accurate delivery estimates
5. **Delivery Proof**: Photo/signature on delivery
6. **Return Tracking**: Track return shipments

---

## 📝 Summary

The Order Tracking system provides:
- ✅ **Real-time order status** visibility
- ✅ **Clear lifecycle timeline** with visual indicators
- ✅ **Courier tracking integration** with dynamic URL resolution
- ✅ **Secure multi-tenant** access control
- ✅ **Public tracking** support (optional)
- ✅ **Audit logging** for all views
- ✅ **Error handling** with clear UX
- ✅ **Responsive frontend** with dark theme

**This completes the customer-facing order visibility layer.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

