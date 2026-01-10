# Courier API Live Tracking Sync - Complete Guide

## 🎯 Overview

The Courier API Live Tracking Sync system integrates with courier APIs (Shiprocket, Delhivery) to automatically sync tracking status and update order status in real-time. This eliminates manual tracking updates and provides customers with accurate, up-to-date order information.

---

## ✅ Architecture

### Tracking Sync Flow

```
Courier API (Shiprocket/Delhivery)
  ↓
Webhook / Polling
  ↓
Courier API Client
  ↓
Tracking Sync Service
  ↓
Order Status Update
  ↓
Customer Visibility
```

### Components

1. **Courier API Clients**: Provider-specific implementations (Shiprocket, Delhivery)
2. **Tracking Sync Service**: Orchestrates sync and status updates
3. **Webhook Handlers**: Receive real-time updates from couriers
4. **Status Mapping**: Maps courier status to order status

---

## 📊 Data Models

### Courier (Enhanced)
```typescript
{
  apiConfig: {
    provider: 'shiprocket' | 'delhivery' | 'manual',
    apiKey?: string,
    apiSecret?: string,
    webhookSecret?: string,
    baseUrl?: string,
    enabled: boolean
  }
}
```

**Purpose**: Store courier API credentials and configuration

---

## 🔧 API Integration

### Shiprocket Integration

**Client**: `ShiprocketClient`

**Features**:
- Authentication via email/password
- Get tracking status by AWB
- Create shipments
- Webhook signature verification

**API Endpoints Used**:
- `POST /auth/login` - Authentication
- `GET /courier/track/awb/:awb` - Get tracking
- `POST /orders/create/adhoc` - Create shipment

### Delhivery Integration

**Client**: `DelhiveryClient`

**Features**:
- Token-based authentication
- Get tracking status by waybill
- Create shipments
- Webhook signature verification

**API Endpoints Used**:
- `GET /api/v1/packages/json?waybill=:awb` - Get tracking
- `POST /api/cmu/create.json` - Create shipment

---

## 🔄 Tracking Sync Service

### `syncOrderTracking(orderId)`

**Flow**:
1. Get order and shipping label
2. Get courier with API config
3. Create courier API client
4. Fetch tracking status from courier
5. Map courier status to order status
6. Update order status if changed
7. Update shipping label metadata

**Status Mapping**:
- `delivered` → `delivered`
- `out for delivery` / `ofd` → `out_for_delivery`
- `shipped` / `dispatched` / `in transit` → `shipped`
- `processing` / `confirmed` → `processing`

---

## 🔔 Webhook Handlers

### Endpoints

1. **Generic**: `POST /api/webhooks/courier/:courierId`
2. **Shiprocket**: `POST /api/webhooks/courier/shiprocket`
3. **Delhivery**: `POST /api/webhooks/courier/delhivery`

### Webhook Flow

```
Courier sends webhook
  ↓
Verify signature (if configured)
  ↓
Extract AWB number
  ↓
Find shipping label
  ↓
Sync tracking status
  ↓
Update order status
  ↓
Return 200 (always)
```

### Security

- **Signature Verification**: HMAC SHA-256
- **Idempotent Processing**: Prevents duplicate updates
- **Error Handling**: Always returns 200 to prevent retries

---

## 🚀 Usage

### Manual Sync

```typescript
import { syncOrderTracking } from './services/courierTrackingSync.service';

// Sync single order
const result = await syncOrderTracking(orderId);
if (result.success && result.statusUpdated) {
  console.log('Order status updated');
}
```

### Batch Sync

```typescript
import { syncMultipleOrdersTracking } from './services/courierTrackingSync.service';

// Sync multiple orders
const results = await syncMultipleOrdersTracking([orderId1, orderId2, orderId3]);
```

### Webhook Configuration

**Shiprocket**:
1. Go to Shiprocket dashboard
2. Settings → Webhooks
3. Add webhook URL: `https://yourdomain.com/api/webhooks/courier/shiprocket`
4. Configure events: `shipment.status_update`

**Delhivery**:
1. Go to Delhivery dashboard
2. Settings → Webhooks
3. Add webhook URL: `https://yourdomain.com/api/webhooks/courier/delhivery`
4. Configure events: `tracking.update`

---

## 📋 Configuration

### Courier API Setup

**Via Admin Panel** (Future):
1. Navigate to Courier Management
2. Select courier
3. Enable API integration
4. Enter API credentials:
   - API Key / Email
   - API Secret / Password
   - Webhook Secret (optional)
5. Save configuration

**Via Database** (Current):
```javascript
await Courier.updateOne(
  { _id: courierId },
  {
    $set: {
      'apiConfig': {
        provider: 'shiprocket',
        apiKey: 'your-email@example.com',
        apiSecret: 'your-password',
        webhookSecret: 'your-webhook-secret',
        baseUrl: 'https://apiv2.shiprocket.in/v1/external',
        enabled: true
      }
    }
  }
);
```

---

## 🔍 Status Mapping

### Shiprocket Status → Order Status

| Shiprocket Status | Order Status |
|-------------------|--------------|
| Delivered | `delivered` |
| Out for Delivery / OFD | `out_for_delivery` |
| Shipped / Dispatched | `shipped` |
| In Transit | `shipped` |
| Processing | `processing` |

### Delhivery Status → Order Status

| Delhivery Status | Order Status |
|------------------|--------------|
| Delivered / DL | `delivered` |
| Out for Delivery / OFD | `out_for_delivery` |
| Dispatched | `shipped` |
| In Transit | `shipped` |
| Processing | `processing` |

---

## 🛡️ Security Features

### ✅ Webhook Signature Verification
- HMAC SHA-256 signature validation
- Prevents unauthorized webhook calls
- Configurable per courier

### ✅ Idempotent Processing
- Prevents duplicate status updates
- Safe to retry webhooks

### ✅ Error Handling
- Always returns 200 to courier
- Logs errors for debugging
- Graceful degradation

### ✅ API Credentials
- Stored securely in database
- Not exposed in responses
- Encrypted at rest (recommended)

---

## 🔄 Integration Points

### Order Lifecycle
- **Auto-updates** order status from courier tracking
- **Preserves** manual status changes
- **Logs** all status transitions

### Shipping Label System
- **Updates** label metadata with tracking info
- **Stores** courier status and location
- **Tracks** last sync timestamp

### Order Tracking Page
- **Shows** real-time tracking from courier
- **Displays** courier tracking URL
- **Updates** automatically via webhooks

---

## 🎯 Best Practices

1. **Enable Webhooks**: Prefer webhooks over polling for real-time updates
2. **Configure Secrets**: Always set webhook secrets for security
3. **Monitor Syncs**: Log all sync operations for debugging
4. **Handle Failures**: Implement retry logic for failed syncs
5. **Rate Limiting**: Respect courier API rate limits
6. **Error Alerts**: Set up alerts for sync failures

---

## ❌ Common Mistakes (Avoided)

✅ **Not verifying webhooks** - Signature verification implemented
✅ **Duplicate updates** - Idempotent processing prevents duplicates
✅ **Blocking webhooks** - Always returns 200 to prevent retries
✅ **Hardcoding statuses** - Dynamic status mapping
✅ **No error handling** - Comprehensive error handling

---

## 🚀 Future Enhancements

1. **Scheduled Polling**: Poll courier APIs for orders without webhooks
2. **Multiple Courier Support**: Support more courier providers
3. **Admin Dashboard**: UI for courier API configuration
4. **Sync Analytics**: Track sync success rates and latency
5. **Retry Logic**: Automatic retry for failed syncs
6. **Notification System**: Notify customers on status updates

---

## 📝 Summary

The Courier API Live Tracking Sync system provides:
- ✅ **Real-time tracking** from courier APIs
- ✅ **Automatic status updates** based on courier tracking
- ✅ **Webhook support** for instant updates
- ✅ **Multiple courier providers** (Shiprocket, Delhivery)
- ✅ **Secure webhook handling** with signature verification
- ✅ **Idempotent processing** prevents duplicates
- ✅ **Error handling** with graceful degradation

**This completes the order tracking automation: Order → Label → Courier API → Status Update → Customer Visibility.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

