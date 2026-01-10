# Unified Tracking System - Complete Guide

## 🎯 Overview

The Unified Tracking System provides comprehensive tracking capabilities for three distinct scenarios:
- **Logistics**: Track outbound orders from placement to delivery
- **Returns**: Track return shipments from pickup to receipt and refund
- **CRM**: Track customer service shipments (replacements, warranty, document delivery, etc.)

This system integrates with courier APIs, provides real-time status updates, and offers a unified API for all tracking scenarios.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [Timeline Building](#timeline-building)
7. [Integration](#integration)

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED TRACKING FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUEST → TRACKING TYPE → VALIDATE ACCESS                  │
│     ↓              ↓              ↓                          │
│  Logistics    Returns      CRM    Security Check            │
│     ↓              ↓              ↓                          │
│  Fetch Data → Build Timeline → Get Courier Info             │
│     ↓              ↓              ↓                          │
│  Merge Events → Format Response → Return                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **TrackingEvent Model**: Stores tracking events for all scenarios
2. **Unified Tracking Service**: Core logic for all tracking types
3. **Unified Tracking Controller**: API endpoints for tracking
4. **Integration**: Works with Order, RMA, ShippingLabel, and Courier models

---

## ✨ Features

### 1. **Multi-Scenario Support**

- **Logistics**: Track orders from creation to delivery
- **Returns**: Track RMAs from request to refund
- **CRM**: Track customer service shipments

### 2. **Real-Time Timeline**

- Status transitions with timestamps
- Location updates
- Event descriptions
- Visual timeline with current status indicator

### 3. **Courier Integration**

- Automatic courier tracking URL generation
- AWB number tracking
- Integration with courier APIs
- Manual tracking event creation

### 4. **Access Control**

- Customer: Only own orders/RMAs
- Reseller: Only own store orders/RMAs
- Admin: Full access
- Public: With email/phone verification

### 5. **Event Sources**

- **System**: Automatic status changes
- **Courier API**: Sync from courier APIs
- **Manual**: Admin-created events
- **Webhook**: Courier webhook updates

### 6. **Rich Tracking Data**

- Current status and description
- Complete timeline
- Courier information with tracking URLs
- Addresses (pickup and delivery)
- Items list
- Expected delivery dates
- Metadata

---

## 📊 Data Models

### TrackingEvent

```typescript
{
  storeId: ObjectId,
  trackingType: 'logistics' | 'returns' | 'crm',
  
  // Reference IDs (one per type)
  orderId?: ObjectId,      // For logistics
  rmaId?: ObjectId,        // For returns
  crmTicketId?: string,    // For CRM
  
  // Tracking details
  status: string,
  location?: string,
  description: string,
  timestamp: Date,
  
  // Courier information
  courierId?: ObjectId,
  awbNumber?: string,
  trackingNumber?: string,
  
  // Source
  source: 'system' | 'courier_api' | 'manual' | 'webhook',
  sourceId?: string,
  
  metadata?: Record<string, any>
}
```

### TrackingData (Response)

```typescript
{
  referenceNumber: string,  // Order number, RMA number, or ticket ID
  trackingType: 'logistics' | 'returns' | 'crm',
  
  // Current status
  currentStatus: string,
  statusLabel: string,
  statusDescription: string,
  
  // Timeline
  timeline: Array<{
    status: string,
    label: string,
    description: string,
    location?: string,
    timestamp: Date,
    isCompleted: boolean,
    isCurrent: boolean,
  }>,
  
  // Courier
  courier?: {
    name: string,
    code: string,
    awbNumber?: string,
    trackingNumber?: string,
    trackingUrl?: string,
  },
  
  // Addresses
  pickupAddress?: Address,
  deliveryAddress?: Address,
  
  // Items
  items?: Array<{
    name: string,
    quantity: number,
    imageUrl?: string,
  }>,
  
  // Dates
  expectedDeliveryDate?: Date,
  estimatedDeliveryDate?: Date,
  
  // Metadata
  metadata?: Record<string, any>
}
```

---

## 🔌 API Endpoints

### Track Logistics (Order)

**GET** `/api/tracking/logistics/:orderNumber?email=user@example.com&phone=1234567890`

Track an order (logistics).

**Response:**
```json
{
  "success": true,
  "data": {
    "referenceNumber": "ORD-ABC-2024-0001",
    "trackingType": "logistics",
    "currentStatus": "shipped",
    "statusLabel": "Shipped",
    "statusDescription": "Your order has been shipped",
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
        "location": "Mumbai Warehouse",
        "timestamp": "2024-01-16T14:30:00Z",
        "isCompleted": false,
        "isCurrent": true
      }
    ],
    "courier": {
      "name": "Delhivery",
      "code": "DEL",
      "awbNumber": "DEL123456789",
      "trackingUrl": "https://track.delhivery.com/DEL123456789"
    },
    "deliveryAddress": {
      "name": "John Doe",
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip": "400001",
      "country": "India"
    },
    "items": [
      {
        "name": "Product Name",
        "quantity": 2
      }
    ],
    "expectedDeliveryDate": "2024-01-20T00:00:00Z"
  }
}
```

### Track Returns (RMA)

**GET** `/api/tracking/returns/:rmaNumber?email=user@example.com&phone=1234567890`

Track a return (RMA).

**Response:**
```json
{
  "success": true,
  "data": {
    "referenceNumber": "RMA-ABC-2024-0001",
    "trackingType": "returns",
    "currentStatus": "picked_up",
    "statusLabel": "Picked Up",
    "statusDescription": "Items have been picked up",
    "timeline": [
      {
        "status": "requested",
        "label": "Return Requested",
        "description": "Return request has been submitted",
        "timestamp": "2024-01-15T10:00:00Z",
        "isCompleted": true,
        "isCurrent": false
      },
      {
        "status": "approved",
        "label": "Return Approved",
        "description": "Return request has been approved",
        "timestamp": "2024-01-15T12:00:00Z",
        "isCompleted": true,
        "isCurrent": false
      },
      {
        "status": "picked_up",
        "label": "Picked Up",
        "description": "Items have been picked up",
        "location": "Customer Location",
        "timestamp": "2024-01-16T14:30:00Z",
        "isCompleted": false,
        "isCurrent": true
      }
    ],
    "courier": {
      "name": "Delhivery",
      "code": "DEL",
      "awbNumber": "DEL987654321",
      "trackingUrl": "https://track.delhivery.com/DEL987654321"
    },
    "pickupAddress": {
      "name": "John Doe",
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip": "400001",
      "country": "India"
    },
    "deliveryAddress": {
      "name": "Store Warehouse",
      "street": "Warehouse St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "zip": "400001",
      "country": "India"
    }
  }
}
```

### Track CRM

**GET** `/api/tracking/crm/:ticketId?email=user@example.com&phone=1234567890`

Track a CRM ticket shipment.

**Response:**
```json
{
  "success": true,
  "data": {
    "referenceNumber": "TICKET-123",
    "trackingType": "crm",
    "currentStatus": "shipped",
    "statusLabel": "Shipped",
    "statusDescription": "Replacement/warranty item has been shipped",
    "timeline": [
      {
        "status": "created",
        "label": "Ticket Created",
        "description": "Support ticket has been created",
        "timestamp": "2024-01-15T10:00:00Z",
        "isCompleted": true,
        "isCurrent": false
      },
      {
        "status": "shipped",
        "label": "Shipped",
        "description": "Replacement item has been shipped",
        "location": "Mumbai Warehouse",
        "timestamp": "2024-01-16T14:30:00Z",
        "isCompleted": false,
        "isCurrent": true
      }
    ],
    "courier": {
      "name": "BlueDart",
      "code": "BD",
      "awbNumber": "BD123456789",
      "trackingUrl": "https://track.bluedart.com/BD123456789"
    }
  }
}
```

### Create Tracking Event

**POST** `/api/tracking/events`

Create a tracking event (admin only).

**Request Body:**
```json
{
  "trackingType": "logistics",
  "orderId": "order_id",
  "status": "in_transit",
  "location": "Mumbai Hub",
  "description": "Package is in transit to delivery hub",
  "courierId": "courier_id",
  "awbNumber": "DEL123456789",
  "source": "manual",
  "metadata": {
    "notes": "Expected delivery tomorrow"
  }
}
```

### List Tracking Events

**GET** `/api/tracking/events?trackingType=logistics&orderId=order_id&page=1&limit=50`

List tracking events with filters.

---

## 💡 Usage Examples

### Example 1: Track Order (Logistics)

```typescript
// Authenticated user
const response = await fetch('/api/tracking/logistics/ORD-ABC-2024-0001', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const { data } = await response.json();
console.log('Current status:', data.currentStatus);
console.log('Timeline:', data.timeline);
```

### Example 2: Track Return (Returns)

```typescript
// Public tracking with email verification
const response = await fetch('/api/tracking/returns/RMA-ABC-2024-0001?email=user@example.com');

const { data } = await response.json();
console.log('Return status:', data.currentStatus);
console.log('Courier:', data.courier);
```

### Example 3: Track CRM Ticket

```typescript
// Authenticated user
const response = await fetch('/api/tracking/crm/TICKET-123', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const { data } = await response.json();
console.log('Ticket status:', data.currentStatus);
```

### Example 4: Create Tracking Event

```typescript
// Admin creates manual tracking event
const response = await fetch('/api/tracking/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    trackingType: 'logistics',
    orderId: 'order_id',
    status: 'in_transit',
    location: 'Mumbai Hub',
    description: 'Package is in transit',
    source: 'manual',
  }),
});
```

---

## 📅 Timeline Building

### Timeline Structure

The timeline is built from multiple sources:

1. **Status History**: From OrderStatusHistory (for orders)
2. **RMA Status Transitions**: From RMA model timestamps
3. **Tracking Events**: From TrackingEvent model
4. **Courier API Updates**: Synced from courier APIs

### Timeline States

- **isCompleted**: `true` for past events
- **isCurrent**: `true` for the current status
- **location**: Optional location information
- **description**: Human-readable description

### Status Labels

Each tracking type has predefined status labels:

- **Logistics**: Order Placed, Payment Pending, Order Confirmed, Preparing Shipment, Shipped, Out for Delivery, Delivered, Cancelled
- **Returns**: Return Requested, Return Approved, Pickup Scheduled, Picked Up, In Transit, Received, Refunded, Closed
- **CRM**: Ticket Created, Assigned, In Progress, Shipped, In Transit, Delivered, Resolved, Closed

---

## 🔗 Integration

### With Order System

- Tracks order status changes
- Integrates with OrderStatusHistory
- Links to shipping labels
- Provides courier tracking URLs

### With RMA System

- Tracks return status changes
- Links to RMA model
- Tracks pickup and delivery
- Provides return courier tracking

### With CRM System

- Tracks customer service shipments
- Links to CRM tickets
- Supports different scenarios (replacement, warranty, etc.)
- Provides CRM courier tracking

### With Courier APIs

- Syncs tracking status from courier APIs
- Creates tracking events automatically
- Updates order/RMA status based on courier updates
- Supports webhook updates

---

## 🎯 Best Practices

1. **Real-Time Updates**: Sync with courier APIs regularly
2. **Event Creation**: Create events for all status changes
3. **Location Tracking**: Include location information when available
4. **Access Control**: Always validate viewer access
5. **Error Handling**: Handle missing data gracefully
6. **Performance**: Cache tracking data when appropriate
7. **Timeline Accuracy**: Ensure timeline events are in chronological order

---

## 📚 Related Documentation

- [Order Tracking System](./ORDER_TRACKING_COMPLETE.md)
- [Courier API Integration](./COURIER_API_TRACKING_COMPLETE.md)
- [RMA System](./RETURNS_REFUNDS_COMPLETE.md)
- [Shipping Label Generator](./SHIPPING_LABEL_GENERATOR.md)

---

## 🚀 Future Enhancements

1. **Real-Time WebSockets**: Push tracking updates in real-time
2. **SMS/Email Notifications**: Notify customers of status changes
3. **Predictive Delivery**: ML-based delivery date prediction
4. **Multi-Courier Support**: Track multiple couriers per shipment
5. **Location History**: Detailed location tracking with maps
6. **Delivery Proof**: Photo/signature capture on delivery
7. **Analytics Dashboard**: Tracking performance metrics

