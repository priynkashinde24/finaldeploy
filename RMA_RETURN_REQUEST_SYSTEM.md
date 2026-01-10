# RMA Return Request System - Complete Guide

## 🎯 Overview

The RMA Return Request System provides a unified interface for creating return requests across three distinct scenarios:
- **Logistics**: Return requests for orders (standard returns)
- **Returns**: Re-return requests or exchanges for previously returned items
- **CRM**: Return requests for customer service scenarios (warranty claims, replacements, defective items, etc.)

This system extends the existing RMA infrastructure to support all return scenarios with scenario-specific logic and validation.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [RMA Lifecycle](#rma-lifecycle)
7. [Integration](#integration)

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  RMA REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUEST → RMA TYPE → VALIDATE → CREATE RMA                 │
│     ↓              ↓              ↓              ↓             │
│  Logistics    Returns      CRM    Eligibility Check         │
│     ↓              ↓              ↓              ↓             │
│  Order Data   Original RMA  Ticket Data  Policy Check       │
│     ↓              ↓              ↓              ↓             │
│  Map Items → Calculate Refund → Generate Number → Save      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **Extended RMA Model**: Supports all three RMA types
2. **Unified RMA Request Service**: Core logic for all scenarios
3. **Unified RMA Request Controller**: API endpoints
4. **RMA Number Generator**: Type-specific numbering

---

## ✨ Features

### 1. **Multi-Scenario Support**

- **Logistics**: Standard order returns
- **Returns**: Re-returns and exchanges
- **CRM**: Warranty, replacements, defective items

### 2. **Scenario-Specific Logic**

- **Logistics**: Validates order status, return window, policy
- **Returns**: Validates original RMA completion, supports exchanges
- **CRM**: Supports warranty claims, replacements, urgency levels

### 3. **Return Policy Validation**

- Return window validation (default: 7 days)
- Category-based return rules
- Condition-based approval
- Non-returnable product flags
- COD return rules

### 4. **Exchange Support**

- Request exchange instead of refund
- Specify exchange variant
- Track exchange status

### 5. **CRM-Specific Features**

- Warranty claims
- Replacement requests
- Urgency levels (low, medium, high, critical)
- Scenario tracking

### 6. **Refund Calculation**

- Proportional refund calculation
- Return shipping deduction
- Tax adjustment
- Item-level refund tracking

---

## 📊 Data Models

### RMA (Extended)

```typescript
{
  storeId: ObjectId,
  rmaType: 'logistics' | 'returns' | 'crm',
  
  // Reference IDs (one per type)
  orderId?: ObjectId,      // For logistics
  rmaId?: ObjectId,         // For returns (re-return)
  crmTicketId?: string,    // For CRM
  
  rmaNumber: string,        // RMA-{STORECODE}-{TYPE}-{YYYY}-{SEQ}
  customerId?: ObjectId,
  
  items: [{
    globalVariantId: ObjectId,
    quantity: number,
    originId: ObjectId,
    reason: string,
    condition: 'sealed' | 'opened' | 'damaged',
    originalPrice: number,
    refundAmount?: number,
    returnShipping?: {
      payer: 'customer' | 'supplier' | 'reseller' | 'platform',
      amount: number,
      ruleSnapshot: {...}
    }
  }],
  
  status: 'requested' | 'approved' | 'rejected' | 'pickup_scheduled' | 
          'picked_up' | 'received' | 'refunded' | 'closed',
  refundMethod: 'original' | 'wallet' | 'cod_adjustment',
  refundAmount: number,
  refundStatus?: 'pending' | 'processing' | 'completed' | 'failed',
  
  // CRM-specific
  crmScenario?: 'warranty' | 'replacement' | 'defective' | 'wrong_item' | 'other',
  urgency?: 'low' | 'medium' | 'high' | 'critical',
  
  // Returns-specific
  originalRmaId?: ObjectId,
  exchangeRequested?: boolean,
  exchangeVariantId?: ObjectId,
  
  // Approval/Rejection
  approvedBy?: ObjectId,
  approvedAt?: Date,
  rejectedBy?: ObjectId,
  rejectedAt?: Date,
  rejectionReason?: string,
  
  // Processing
  receivedAt?: Date,
  refundedAt?: Date,
  creditNoteId?: ObjectId,
  
  metadata?: Record<string, any>
}
```

---

## 🔌 API Endpoints

### Create RMA Request

**POST** `/api/rma-requests`

Create an RMA request for any scenario.

**Request Body (Logistics):**
```json
{
  "rmaType": "logistics",
  "orderId": "ORD-ABC-2024-0001",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 1,
      "reason": "defective",
      "condition": "damaged"
    }
  ],
  "refundMethod": "original"
}
```

**Request Body (Returns - Exchange):**
```json
{
  "rmaType": "returns",
  "rmaId": "rma_id",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 1,
      "reason": "wrong_size",
      "condition": "sealed"
    }
  ],
  "refundMethod": "wallet",
  "exchangeRequested": true,
  "exchangeVariantId": "new_variant_id"
}
```

**Request Body (CRM - Warranty):**
```json
{
  "rmaType": "crm",
  "crmTicketId": "TICKET-123",
  "items": [
    {
      "globalVariantId": "variant_id",
      "quantity": 1,
      "reason": "defective",
      "condition": "damaged"
    }
  ],
  "refundMethod": "original",
  "crmScenario": "warranty",
  "urgency": "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rma": {
      "id": "rma_id",
      "rmaNumber": "RMA-ABC-LOG-2024-0001",
      "rmaType": "logistics",
      "status": "requested",
      "refundAmount": 1500,
      "items": [
        {
          "globalVariantId": "variant_id",
          "quantity": 1,
          "reason": "defective",
          "condition": "damaged"
        }
      ]
    }
  }
}
```

### Get RMA Request

**GET** `/api/rma-requests/:rmaType/:referenceId`

Get RMA request by order ID, RMA ID, or CRM ticket ID.

**Examples:**
- `/api/rma-requests/logistics/ORD-ABC-2024-0001`
- `/api/rma-requests/returns/rma_id`
- `/api/rma-requests/crm/TICKET-123`

### List RMA Requests

**GET** `/api/rma-requests?rmaType=logistics&status=requested&page=1&limit=50`

List RMA requests with filters.

---

## 💡 Usage Examples

### Example 1: Create Logistics RMA Request

```typescript
// Customer creates return request for order
const result = await createRMARequest({
  rmaType: 'logistics',
  orderId: 'ORD-ABC-2024-0001',
  items: [
    {
      globalVariantId: variantId,
      quantity: 1,
      reason: 'defective',
      condition: 'damaged',
    },
  ],
  refundMethod: 'original',
  storeId: storeId,
  customerId: customerId,
});

if (result.success) {
  console.log('RMA created:', result.rma.rmaNumber);
  console.log('Refund amount:', result.rma.refundAmount);
}
```

### Example 2: Create Returns RMA (Exchange)

```typescript
// Customer requests exchange for wrong size
const result = await createRMARequest({
  rmaType: 'returns',
  rmaId: originalRmaId,
  items: [
    {
      globalVariantId: variantId,
      quantity: 1,
      reason: 'wrong_size',
      condition: 'sealed',
    },
  ],
  refundMethod: 'wallet',
  storeId: storeId,
  customerId: customerId,
  exchangeRequested: true,
  exchangeVariantId: newVariantId,
});

if (result.success) {
  console.log('Exchange RMA created:', result.rma.rmaNumber);
}
```

### Example 3: Create CRM RMA (Warranty)

```typescript
// Create warranty claim
const result = await createRMARequest({
  rmaType: 'crm',
  crmTicketId: 'TICKET-123',
  items: [
    {
      globalVariantId: variantId,
      quantity: 1,
      reason: 'defective',
      condition: 'damaged',
    },
  ],
  refundMethod: 'original',
  storeId: storeId,
  customerId: customerId,
  crmScenario: 'warranty',
  urgency: 'high',
});

if (result.success) {
  console.log('Warranty RMA created:', result.rma.rmaNumber);
}
```

### Example 4: Get RMA Request

```typescript
// Get RMA for an order
const rma = await getRMARequest('logistics', orderId, storeId);

if (rma) {
  console.log('RMA found:', rma.rmaNumber);
  console.log('Status:', rma.status);
  console.log('Refund amount:', rma.refundAmount);
}
```

---

## 🔄 RMA Lifecycle

### Status Flow

```
requested → approved → pickup_scheduled → picked_up → received → refunded → closed
     ↓
  rejected (with reason)
```

### Status Descriptions

- **requested**: Customer has submitted return request
- **approved**: Admin/supplier approved the return
- **rejected**: Return request rejected (with reason)
- **pickup_scheduled**: Pickup has been scheduled
- **picked_up**: Items have been picked up
- **received**: Items received at warehouse
- **refunded**: Refund has been processed
- **closed**: RMA is closed

---

## 🎯 RMA Number Format

### Format

**Format**: `RMA-{STORECODE}-{TYPE}-{YYYY}-{SEQ}`

**Examples:**
- Logistics: `RMA-ABC-LOG-2024-0001`
- Returns: `RMA-ABC-RET-2024-0001`
- CRM: `RMA-ABC-CRM-2024-0001`

**Components:**
- `RMA` - RMA prefix
- `STORECODE` - Store's unique code
- `TYPE` - RMA type (LOG, RET, CRM)
- `YYYY` - Year
- `SEQ` - Sequential number (4 digits, zero-padded)

---

## 🔗 Integration

### With Order System

- Links to orders via `orderId`
- Validates order status and delivery
- Uses order fulfillment snapshot for origin mapping
- Calculates refunds based on order prices

### With RMA System

- Links to original RMAs for re-returns
- Supports exchange requests
- Tracks return history

### With CRM System

- Links to CRM tickets via `crmTicketId`
- Supports different scenarios (warranty, replacement, etc.)
- Tracks urgency levels

### With Return Policy Engine

- Validates return eligibility
- Checks return window
- Applies category-based rules
- Validates item conditions

### With Fulfillment Routing

- Uses fulfillment snapshot for origin mapping
- Supports multi-origin returns
- Tracks origin information per item

---

## 📝 Return Policy Rules

### Logistics Returns

- **Return Window**: Default 7 days from delivery
- **Order Status**: Must be `delivered`
- **Partial Returns**: Supported
- **Multi-Origin**: Supported
- **Conditions**: sealed, opened, damaged

### Returns (Re-returns)

- **Original RMA**: Must be completed (received/refunded/closed)
- **Exchange Support**: Can request exchange
- **Exchange Variant**: Specify replacement variant

### CRM Returns

- **Warranty Claims**: No return window limit
- **Replacements**: Can request replacement instead of refund
- **Urgency**: Supports urgency levels
- **Scenarios**: warranty, replacement, defective, wrong_item, other

---

## 🚀 Best Practices

1. **Validate Early**: Validate return eligibility before creating RMA
2. **Track Origins**: Always track origin information for items
3. **Calculate Accurately**: Calculate refunds proportionally
4. **Handle Exchanges**: Support exchange requests for better UX
5. **Monitor Status**: Track RMA status throughout lifecycle
6. **Audit Trail**: Keep complete audit trail of all actions
7. **Customer Communication**: Notify customers of status changes

---

## 📚 Related Documentation

- [RMA System](./RMA_SYSTEM_COMPLETE.md)
- [Returns & Refunds](./RETURNS_REFUNDS_COMPLETE.md)
- [Fulfillment Routing](./MULTI_ORIGIN_FULFILLMENT_ROUTING.md)
- [Unified Tracking](./UNIFIED_TRACKING_SYSTEM.md)

---

## 🎯 Future Enhancements

1. **Auto-Approval**: Auto-approve RMAs based on rules
2. **Bulk Returns**: Support bulk return requests
3. **Return Analytics**: Analytics dashboard for returns
4. **Predictive Returns**: ML-based return prediction
5. **Return Prevention**: Identify and prevent unnecessary returns
6. **Exchange Automation**: Automate exchange processing
7. **Return Labels**: Auto-generate return labels

