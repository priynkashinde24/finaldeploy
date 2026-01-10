# Shipping Label Generator System - Complete Guide

## 🎯 Overview

The Shipping Label Generator System provides unified label generation for three distinct scenarios:
- **Logistics**: Outbound shipping labels for customer orders
- **Returns**: Reverse logistics labels for return pickups and deliveries
- **CRM**: Customer service labels for replacements, warranty, document delivery, etc.

This system integrates with the courier mapping system to automatically select appropriate couriers and generates printable PDF labels with all necessary information.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [Label Formats](#label-formats)
7. [Integration](#integration)

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  LABEL GENERATION FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUEST → LABEL TYPE → VALIDATE → MAP COURIER             │
│     ↓              ↓              ↓              ↓           │
│  Logistics    Returns      CRM    Status Check              │
│     ↓              ↓              ↓              ↓           │
│  Order Data   RMA Data   Ticket Data  Courier Mapping      │
│     ↓              ↓              ↓              ↓           │
│  BUILD LABEL DATA → GENERATE PDF → SAVE → EMIT EVENT       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **ShippingLabel Model**: Extended to support all three label types
2. **Label Generator Service**: Unified service for all label types
3. **Label Generator Controller**: API endpoints for label operations
4. **Courier Mapping Integration**: Automatic courier selection
5. **PDF Generator**: Creates printable labels with barcodes/QR codes

---

## ✨ Features

### 1. **Multi-Scenario Support**

- **Logistics**: Outbound shipping for orders
- **Returns**: Reverse logistics for RMAs
- **CRM**: Customer service scenarios (replacements, warranty, etc.)

### 2. **Automatic Courier Mapping**

- Integrates with courier mapping system
- Automatically selects appropriate courier based on scenario
- Supports manual courier override

### 3. **Smart Address Resolution**

- **Logistics**: Pickup from store/supplier origin, delivery to customer
- **Returns**: Pickup from customer, delivery to origin/warehouse
- **CRM**: Pickup from store, delivery based on ticket data

### 4. **Label Numbering**

- Unique label numbers per type
- Format: `LBL-{STORECODE}-{TYPE}-{YYYY}-{SEQ}`
- Examples:
  - Logistics: `LBL-ABC-LOG-2024-0001`
  - Returns: `LBL-ABC-RET-2024-0001`
  - CRM: `LBL-ABC-CRM-2024-0001`

### 5. **PDF Generation**

- Printable 4x6 inch labels
- Includes barcode/QR code
- Courier information
- Address details
- Package details
- Order/RMA/CRM details

### 6. **Status Management**

- `generated`: Active label
- `cancelled`: Cancelled label
- One active label per reference (order/RMA/ticket)

---

## 📊 Data Models

### ShippingLabel (Extended)

```typescript
{
  storeId: ObjectId,
  labelType: 'logistics' | 'returns' | 'crm',
  
  // Reference IDs (one per type)
  orderId?: ObjectId,      // For logistics
  rmaId?: ObjectId,         // For returns
  crmTicketId?: string,    // For CRM
  
  // Courier information
  courierId: ObjectId,
  courierName: string,
  courierCode: string,
  
  // Label details
  labelNumber: string,     // LBL-{STORECODE}-{TYPE}-{YYYY}-{SEQ}
  awbNumber?: string,       // Airway Bill Number
  
  // Addresses
  pickupAddress: {
    name, street, city, state, zip, country, phone?
  },
  deliveryAddress: {
    name, street, city, state, zip, country, phone?
  },
  
  // Package details
  packageDetails: {
    weight: number,        // kg
    dimensions?: { length, width, height } // cm
  },
  
  // Scenario-specific details
  orderDetails?: {
    orderNumber, orderId, itemCount,
    codAmount?, prepaidAmount?
  },
  returnDetails?: {
    rmaNumber, returnReason, itemCondition, itemCount
  },
  crmDetails?: {
    ticketId, scenario, urgency, description
  },
  
  // Status
  pdfUrl: string,
  status: 'generated' | 'cancelled',
  generatedAt: Date,
  generatedBy: ObjectId,
  metadata?: Record<string, any>
}
```

---

## 🔌 API Endpoints

### Generate Label

**POST** `/api/labels/generate`

Generate a shipping label for any scenario.

**Request Body:**
```json
{
  "labelType": "logistics",
  "orderId": "order_id",
  "courierId": "courier_id"  // Optional: override courier
}
```

**For Returns:**
```json
{
  "labelType": "returns",
  "rmaId": "rma_id",
  "courierId": "courier_id"  // Optional
}
```

**For CRM:**
```json
{
  "labelType": "crm",
  "crmTicketId": "ticket_123",
  "scenario": "replacement",
  "urgency": "high",
  "customerTier": "premium",
  "courierId": "courier_id"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "label": {
      "id": "label_id",
      "labelNumber": "LBL-ABC-LOG-2024-0001",
      "labelType": "logistics",
      "pdfUrl": "/api/shipping-labels/LBL-ABC-LOG-2024-0001/download",
      "courierName": "Delhivery",
      "courierCode": "DEL",
      "status": "generated",
      "generatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Get Label by Reference

**GET** `/api/labels/:labelType/:referenceId`

Get label by order ID, RMA ID, or CRM ticket ID.

**Examples:**
- `/api/labels/logistics/order_id`
- `/api/labels/returns/rma_id`
- `/api/labels/crm/ticket_123`

**Response:**
```json
{
  "success": true,
  "data": {
    "label": {
      "id": "label_id",
      "labelNumber": "LBL-ABC-LOG-2024-0001",
      "labelType": "logistics",
      "pdfUrl": "/api/shipping-labels/LBL-ABC-LOG-2024-0001/download",
      "orderDetails": {
        "orderNumber": "ORD-ABC-2024-0001",
        "itemCount": 3,
        "codAmount": 1500
      },
      "status": "generated"
    }
  }
}
```

### List Labels

**GET** `/api/labels?labelType=logistics&status=generated&page=1&limit=50`

List labels with filters.

**Query Parameters:**
- `labelType`: Filter by type (logistics, returns, crm)
- `status`: Filter by status (generated, cancelled)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

---

## 💡 Usage Examples

### Example 1: Generate Logistics Label

```typescript
// Generate label for an order
const result = await generateLabel({
  labelType: 'logistics',
  orderId: orderId,
  storeId: storeId,
  generatedBy: userId,
});

if (result.success) {
  console.log('Label generated:', result.label.labelNumber);
  console.log('PDF URL:', result.label.pdfUrl);
}
```

### Example 2: Generate Returns Label

```typescript
// Generate label for a return
const result = await generateLabel({
  labelType: 'returns',
  rmaId: rmaId,
  storeId: storeId,
  generatedBy: userId,
});

if (result.success) {
  console.log('Returns label generated:', result.label.labelNumber);
}
```

### Example 3: Generate CRM Label

```typescript
// Generate label for CRM replacement
const result = await generateLabel({
  labelType: 'crm',
  crmTicketId: 'TICKET-123',
  scenario: 'replacement',
  urgency: 'high',
  customerTier: 'premium',
  storeId: storeId,
  generatedBy: userId,
});

if (result.success) {
  console.log('CRM label generated:', result.label.labelNumber);
}
```

### Example 4: Get Label

```typescript
// Get label for an order
const label = await getLabel('logistics', orderId, storeId);

if (label) {
  console.log('Label found:', label.labelNumber);
  console.log('PDF URL:', label.pdfUrl);
}
```

---

## 🏷️ Label Formats

### Label Number Format

**Format**: `LBL-{STORECODE}-{TYPE}-{YYYY}-{SEQ}`

**Examples:**
- `LBL-ABC-LOG-2024-0001` - Logistics label
- `LBL-ABC-RET-2024-0001` - Returns label
- `LBL-ABC-CRM-2024-0001` - CRM label

**Components:**
- `LBL` - Label prefix
- `STORECODE` - Store's unique code
- `TYPE` - Label type (LOG, RET, CRM)
- `YYYY` - Year
- `SEQ` - Sequential number (4 digits, zero-padded)

### PDF Label Layout

- **Size**: 4x6 inches (A6)
- **Content**:
  - Label number and barcode/QR code
  - Courier information
  - Pickup address
  - Delivery address
  - Package details (weight, dimensions)
  - Order/RMA/CRM details
  - AWB number (if available)

---

## 🔗 Integration

### With Courier Mapping System

The label generator automatically uses the courier mapping system to select appropriate couriers:

- **Logistics**: Uses `mapCourierForLogistics()` based on order details
- **Returns**: Uses `mapCourierForReturns()` based on RMA details
- **CRM**: Uses `mapCourierForCRM()` based on scenario and urgency

### With Order System

- Generates labels when orders are ready to ship
- Links labels to orders via `orderId`
- Validates order status before generation

### With RMA System

- Generates labels when RMAs are approved
- Links labels to RMAs via `rmaId`
- Handles reverse logistics addresses

### With CRM System

- Generates labels for customer service scenarios
- Links labels to tickets via `crmTicketId`
- Supports different urgency levels

---

## 📝 Label Generation Rules

### Logistics Labels

- **Required**: Order ID
- **Status Check**: Order must be `confirmed` or `processing`
- **Courier**: Auto-mapped or manually specified
- **Addresses**: Pickup from store/origin, delivery to customer

### Returns Labels

- **Required**: RMA ID
- **Status Check**: RMA must be `approved`, `pickup_scheduled`, or `picked_up`
- **Courier**: Auto-mapped for returns or manually specified
- **Addresses**: Pickup from customer, delivery to origin/warehouse

### CRM Labels

- **Required**: CRM ticket ID and scenario
- **Courier**: Auto-mapped based on scenario and urgency
- **Addresses**: Pickup from store, delivery from ticket data
- **Scenarios**: support_ticket, document_delivery, replacement, warranty

---

## 🚀 Best Practices

1. **Generate Early**: Generate labels when orders/RMAs are ready
2. **Validate Status**: Check order/RMA status before generation
3. **Use Courier Mapping**: Let the system auto-select couriers
4. **Store PDFs**: Store generated PDFs in cloud storage (S3, etc.)
5. **Track Labels**: Monitor label generation and usage
6. **Handle Errors**: Implement retry logic for failed generations

---

## 🔄 Event System

The label generator emits events when labels are created:

**Event Type**: `LABEL_GENERATED`

**Payload**:
```json
{
  "labelType": "logistics",
  "orderId": "order_id",
  "orderNumber": "ORD-ABC-2024-0001",
  "labelNumber": "LBL-ABC-LOG-2024-0001",
  "courierName": "Delhivery"
}
```

---

## 📚 Related Documentation

- [Courier Mapping System](./COURIER_MAPPING_SYSTEM.md)
- [RMA System](./RETURNS_REFUNDS_COMPLETE.md)
- [Order Lifecycle](./COMPLETE_ORDER_LIFECYCLE.md)

---

## 🎯 Future Enhancements

1. **Bulk Generation**: Generate multiple labels at once
2. **Label Templates**: Customizable label templates per courier
3. **AWB Integration**: Automatic AWB number generation from courier APIs
4. **Label Tracking**: Track label usage and printing
5. **Multi-language**: Support multiple languages on labels
6. **Custom Fields**: Add custom fields to labels
7. **Label Preview**: Preview labels before generation

