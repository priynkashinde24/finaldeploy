# Multi-Origin Supplier Fulfillment Routing - Complete Guide

## 🎯 Overview

The Multi-Origin Supplier Fulfillment Routing system provides intelligent routing for three distinct scenarios:
- **Logistics**: Route orders to the best supplier origin (warehouse) for outbound shipping
- **Returns**: Route return shipments to the appropriate processing center
- **CRM**: Route customer service shipments (replacements, warranty, etc.) to service centers

This system optimizes routing based on multiple factors including cost, speed, distance, and priority, supporting both single-origin and multi-origin fulfillment.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [Routing Strategies](#routing-strategies)
7. [Integration](#integration)

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│              FULFILLMENT ROUTING FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUEST → ROUTE TYPE → VALIDATE ITEMS                      │
│     ↓              ↓              ↓                          │
│  Logistics    Returns      CRM    Check Stock              │
│     ↓              ↓              ↓                          │
│  Find Origins → Calculate Scores → Select Best              │
│     ↓              ↓              ↓                          │
│  Build Route → Create Groups → Save Route                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **FulfillmentRoute Model**: Stores routing decisions for all scenarios
2. **Unified Fulfillment Routing Service**: Core routing logic
3. **Fulfillment Routing Controller**: API endpoints
4. **Integration**: Works with SupplierOrigin, OriginVariantInventory, Courier Mapping

---

## ✨ Features

### 1. **Multi-Scenario Support**

- **Logistics**: Route orders to best origin based on inventory, distance, cost
- **Returns**: Route returns to processing centers
- **CRM**: Route customer service shipments to service centers

### 2. **Routing Strategies**

- **Cost**: Minimize shipping cost
- **Speed**: Minimize delivery time
- **Distance**: Minimize distance
- **Priority**: Use origin priority
- **Balanced**: Weighted combination of all factors

### 3. **Multi-Origin Support**

- Route items to different origins
- Create shipment groups per origin
- Independent tracking per shipment
- Optimize for split shipments

### 4. **Intelligent Scoring**

- Distance calculation (40% weight for balanced)
- Shipping cost (30% weight for balanced)
- Origin priority (20% weight for balanced)
- Courier availability (10% weight for balanced)

### 5. **Courier Integration**

- Automatic courier mapping
- Integration with courier mapping system
- Support for different couriers per origin

### 6. **Route Management**

- Route confirmation workflow
- Route status tracking
- Route history and audit trail

---

## 📊 Data Models

### FulfillmentRoute

```typescript
{
  storeId: ObjectId,
  routeType: 'logistics' | 'returns' | 'crm',
  
  // Reference IDs
  orderId?: ObjectId,      // For logistics
  rmaId?: ObjectId,         // For returns
  crmTicketId?: string,    // For CRM
  
  // Routing details
  items: [{
    globalVariantId: ObjectId,
    quantity: number,
    supplierId: ObjectId,
    originId: ObjectId,
    originName: string,
    routingScore: number,
    shippingCost?: number,
    courierId?: ObjectId,
    shippingZoneId?: ObjectId,
  }],
  
  shipmentGroups: [{
    originId: ObjectId,
    originName: string,
    items: [{
      globalVariantId: ObjectId,
      quantity: number,
    }],
    shippingCost: number,
    courierId?: ObjectId,
    shippingZoneId?: ObjectId,
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
  }],
  
  deliveryAddress: {
    street, city, state, zip, country
  },
  
  totalShippingCost: number,
  routingStrategy: 'cost' | 'speed' | 'distance' | 'priority' | 'balanced',
  routingScore: number,
  
  status: 'pending' | 'confirmed' | 'cancelled',
  confirmedAt?: Date,
  cancelledAt?: Date,
  
  metadata?: Record<string, any>
}
```

---

## 🔌 API Endpoints

### Route Fulfillment

**POST** `/api/fulfillment-routing/route`

Route fulfillment for any scenario.

**Request Body (Logistics):**
```json
{
  "routeType": "logistics",
  "orderId": "order_id",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 2,
      "supplierId": "supplier_id"
    }
  ],
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001",
    "country": "India"
  },
  "routingStrategy": "balanced",
  "paymentMethod": "cod",
  "orderValue": 1500
}
```

**Request Body (Returns):**
```json
{
  "routeType": "returns",
  "rmaId": "rma_id",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 1
    }
  ],
  "deliveryAddress": {
    "street": "Warehouse St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001",
    "country": "India"
  },
  "originZoneId": "zone_id",
  "routingStrategy": "cost"
}
```

**Request Body (CRM):**
```json
{
  "routeType": "crm",
  "crmTicketId": "TICKET-123",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 1
    }
  ],
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zip": "400001",
    "country": "India"
  },
  "urgency": "high",
  "routingStrategy": "speed"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "route": {
      "id": "route_id",
      "routeType": "logistics",
      "items": [
        {
          "globalVariantId": "variant_id",
          "quantity": 2,
          "originId": "origin_id",
          "originName": "Mumbai Warehouse",
          "routingScore": 45.5,
          "shippingCost": 50
        }
      ],
      "shipmentGroups": [
        {
          "originId": "origin_id",
          "originName": "Mumbai Warehouse",
          "items": [
            {
              "globalVariantId": "variant_id",
              "quantity": 2
            }
          ],
          "shippingCost": 50,
          "status": "pending"
        }
      ],
      "totalShippingCost": 50,
      "routingStrategy": "balanced",
      "routingScore": 45.5,
      "status": "pending"
    }
  }
}
```

### Get Fulfillment Route

**GET** `/api/fulfillment-routing/:routeType/:referenceId`

Get fulfillment route by order ID, RMA ID, or CRM ticket ID.

**Examples:**
- `/api/fulfillment-routing/logistics/order_id`
- `/api/fulfillment-routing/returns/rma_id`
- `/api/fulfillment-routing/crm/ticket_id`

### Confirm Fulfillment Route

**POST** `/api/fulfillment-routing/:routeId/confirm`

Confirm a fulfillment route (moves from pending to confirmed).

### List Fulfillment Routes

**GET** `/api/fulfillment-routing/routes?routeType=logistics&status=pending&page=1&limit=50`

List fulfillment routes with filters.

---

## 💡 Usage Examples

### Example 1: Route Logistics Order

```typescript
// Route order to best origin
const result = await routeFulfillment({
  routeType: 'logistics',
  orderId: orderId,
  items: [
    { globalVariantId: variantId1, quantity: 2 },
    { globalVariantId: variantId2, quantity: 1 },
  ],
  deliveryAddress: {
    street: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400001',
    country: 'India',
  },
  storeId: storeId,
  routingStrategy: 'balanced',
  paymentMethod: 'cod',
  orderValue: 1500,
});

if (result.success) {
  console.log('Route created:', result.route._id);
  console.log('Shipment groups:', result.route.shipmentGroups.length);
  console.log('Total shipping cost:', result.route.totalShippingCost);
}
```

### Example 2: Route Return (RMA)

```typescript
// Route return to processing center
const result = await routeFulfillment({
  routeType: 'returns',
  rmaId: rmaId,
  items: [
    { globalVariantId: variantId, quantity: 1 },
  ],
  deliveryAddress: {
    street: 'Warehouse St',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400001',
    country: 'India',
  },
  storeId: storeId,
  originZoneId: originZoneId,
  routingStrategy: 'cost',
});

if (result.success) {
  console.log('Return route created:', result.route._id);
}
```

### Example 3: Route CRM Shipment

```typescript
// Route CRM replacement
const result = await routeFulfillment({
  routeType: 'crm',
  crmTicketId: 'TICKET-123',
  items: [
    { globalVariantId: variantId, quantity: 1 },
  ],
  deliveryAddress: {
    street: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400001',
    country: 'India',
  },
  storeId: storeId,
  urgency: 'high',
  routingStrategy: 'speed',
});

if (result.success) {
  console.log('CRM route created:', result.route._id);
}
```

### Example 4: Get Fulfillment Route

```typescript
// Get route for an order
const route = await getFulfillmentRoute('logistics', orderId, storeId);

if (route) {
  console.log('Route found:', route._id);
  console.log('Shipment groups:', route.shipmentGroups.length);
  console.log('Status:', route.status);
}
```

### Example 5: Confirm Route

```typescript
// Confirm a route
const result = await confirmFulfillmentRoute(routeId, storeId);

if (result.success) {
  console.log('Route confirmed:', result.route.status);
}
```

---

## 🎯 Routing Strategies

### 1. Cost Strategy

- **Weight**: 100% shipping cost
- **Use Case**: Minimize shipping expenses
- **Best For**: Low-value orders, cost-sensitive customers

### 2. Speed Strategy

- **Weight**: 100% distance + courier speed
- **Use Case**: Fastest delivery
- **Best For**: Urgent orders, premium customers

### 3. Distance Strategy

- **Weight**: 100% distance
- **Use Case**: Minimize shipping distance
- **Best For**: Local deliveries, same-city orders

### 4. Priority Strategy

- **Weight**: 100% origin priority
- **Use Case**: Use preferred origins
- **Best For**: Preferred suppliers, strategic routing

### 5. Balanced Strategy (Default)

- **Weights**:
  - Distance: 40%
  - Shipping Cost: 30%
  - Origin Priority: 20%
  - Courier Availability: 10%
- **Use Case**: Optimal overall routing
- **Best For**: General orders, standard fulfillment

---

## 🔗 Integration

### With Order System

- Routes orders during creation
- Stores routing decisions in FulfillmentRoute
- Links to order via orderId
- Supports multi-origin orders

### With RMA System

- Routes returns to processing centers
- Links to RMA via rmaId
- Supports return-specific routing logic

### With CRM System

- Routes customer service shipments
- Links to tickets via crmTicketId
- Supports urgency-based routing

### With Courier Mapping

- Integrates with courier mapping system
- Automatically selects couriers per origin
- Supports different couriers per shipment group

### With Inventory System

- Checks origin-level inventory
- Reserves inventory at origin level
- Prevents overselling

---

## 📝 Routing Score Calculation

### Balanced Strategy Formula

```
Score = (Distance × 0.4) + (ShippingCost × 0.3) + (Priority × 0.2) + ((100 - CourierCount) × 0.1)
```

### Other Strategies

- **Cost**: `Score = ShippingCost`
- **Speed**: `Score = Distance + (CourierSpeed × Factor)`
- **Distance**: `Score = Distance`
- **Priority**: `Score = OriginPriority`

---

## 🚀 Best Practices

1. **Route Early**: Route fulfillment during order creation
2. **Confirm Routes**: Confirm routes before processing
3. **Monitor Performance**: Track routing scores and outcomes
4. **Optimize Origins**: Regularly review origin priorities
5. **Handle Failures**: Implement fallback routing
6. **Cache Results**: Cache routing decisions when appropriate
7. **Audit Routes**: Keep audit trail of routing decisions

---

## 📚 Related Documentation

- [Courier Mapping System](./COURIER_MAPPING_SYSTEM.md)
- [Shipping Label Generator](./SHIPPING_LABEL_GENERATOR.md)
- [Unified Tracking System](./UNIFIED_TRACKING_SYSTEM.md)
- [Multi-Origin Fulfillment](./MULTI_ORIGIN_FULFILLMENT_COMPLETE.md)

---

## 🎯 Future Enhancements

1. **Machine Learning**: Learn from historical routing performance
2. **Real-Time Inventory**: Real-time inventory sync for routing
3. **Dynamic Routing**: Re-route based on real-time conditions
4. **Multi-Warehouse Optimization**: Optimize across multiple warehouses
5. **Route Analytics**: Analytics dashboard for routing performance
6. **A/B Testing**: Test different routing strategies
7. **Predictive Routing**: Predict best routes using ML

