# Shipping Label Generation System - Complete Guide

## 🎯 Overview

The Shipping Label Generation system provides printable PDF labels for marketplace orders with complete courier, address, order, and barcode information. Labels are frozen once generated and required before shipment.

---

## ✅ Architecture

### Label Generation Flow

```
Order (confirmed/processing)
  → Validate courier assigned
  → Generate label number
  → Build label data (addresses, package, order)
  → Generate PDF with QR code
  → Save ShippingLabel record
  → Emit LABEL_GENERATED event
```

### Label Requirements

- **Order Status**: `confirmed` or `processing` (can generate)
- **Order Status**: `shipped` (requires label)
- **Courier**: Must be assigned before label generation
- **Uniqueness**: One active label per order

---

## 📊 Data Models

### ShippingLabel
```typescript
{
  storeId: ObjectId,
  orderId: ObjectId,
  courierId: ObjectId,
  courierName: string,
  courierCode: string,
  labelNumber: string,        // LBL-{STORECODE}-{YYYY}-{SEQ}
  awbNumber?: string,         // Airway Bill (from courier API)
  pickupAddress: {
    name, street, city, state, zip, country, phone?
  },
  deliveryAddress: {
    name, street, city, state, zip, country, phone?
  },
  packageDetails: {
    weight: number,           // kg
    dimensions?: { length, width, height } // cm
  },
  orderDetails: {
    orderNumber, orderId, itemCount,
    codAmount?, prepaidAmount?
  },
  pdfUrl: string,
  status: 'generated' | 'cancelled',
  generatedAt: Date,
  generatedBy: ObjectId
}
```

---

## 🔧 Configuration

### Label Number Format

**Format**: `LBL-{STORECODE}-{YYYY}-{SEQ}`

**Example**: `LBL-ABC-2024-0001`

- **STORECODE**: Store's unique code
- **YYYY**: Current year
- **SEQ**: Sequential number (4 digits, zero-padded)

**Generation**: Atomic increment per store per year

---

## 🚀 Usage

### Generate Shipping Label

**API**: `POST /api/orders/:id/shipping-label`

**Access**: Admin, Supplier (own orders), Reseller

**Request**:
```http
POST /api/orders/order_123/shipping-label
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "label": {
      "labelNumber": "LBL-ABC-2024-0001",
      "pdfUrl": "/api/shipping-labels/LBL-ABC-2024-0001/download",
      "status": "generated",
      "generatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Validation**:
- Order must be in `confirmed` or `processing` status
- Courier must be assigned
- No existing active label

### Download Shipping Label PDF

**API**: `GET /api/shipping-labels/:id/download`

**Access**: Admin, Supplier (own orders), Reseller

**Request**:
```http
GET /api/shipping-labels/LBL-ABC-2024-0001/download
Authorization: Bearer <token>
```

**Response**: PDF file (application/pdf)

### Get Label for Order

**API**: `GET /api/orders/:id/shipping-label`

**Access**: Admin, Supplier (own orders), Reseller

**Response**:
```json
{
  "success": true,
  "data": {
    "label": {
      "labelNumber": "LBL-ABC-2024-0001",
      "courierName": "Delhivery",
      "status": "generated",
      "pdfUrl": "/api/shipping-labels/LBL-ABC-2024-0001/download"
    }
  }
}
```

---

## 📄 PDF Label Template

### Layout: 4x6 inches (A6)

**Content**:
1. **Header**: "SHIPPING LABEL"
2. **Payment Badge**: "COD" (red) or "PREPAID" (green)
3. **Courier Name**: Bold, centered
4. **Label Number**: `LBL-ABC-2024-0001`
5. **AWB Number**: (if available from courier API)
6. **Order Number**: `ORD-ABC-2024-0001`
7. **FROM Address**: Pickup address (store/supplier)
8. **TO Address**: Delivery address (customer)
9. **Package Details**: Weight, dimensions, item count
10. **COD Amount**: (if COD order, red, bold)
11. **QR Code**: Encodes orderId or awbNumber
12. **Footer**: Generation timestamp

### QR Code

- **Encodes**: `awbNumber` (if available) or `orderId`
- **Size**: 80x80 points
- **Position**: Centered, below package details
- **Library**: `qrcode` (npm package)

---

## 🔄 Order Lifecycle Integration

### Label Generation Rules

**Allowed When**:
- `orderStatus = 'confirmed'` ✅
- `orderStatus = 'processing'` ✅

**Blocked When**:
- `orderStatus < 'confirmed'` ❌
- `orderStatus >= 'shipped'` ❌
- No courier assigned ❌
- Label already exists ❌

### Shipment Requirements

**Before Shipping** (`orderStatus = 'shipped'`):
- ✅ Courier must be assigned
- ✅ Shipping label must be generated
- ✅ Tracking number required

**Validation**:
```typescript
// In orderLifecycle.service.ts
if (!existingLabel) {
  throw new Error('Shipping label must be generated before order can be shipped');
}
```

---

## 📋 API Endpoints

### Generate Label
```http
POST /api/orders/:id/shipping-label
Authorization: Bearer <token>
```

**Roles**: Admin, Supplier (own orders), Reseller

**Response**: `201 Created` with label data

### Download PDF
```http
GET /api/shipping-labels/:id/download
Authorization: Bearer <token>
```

**Roles**: Admin, Supplier (own orders), Reseller

**Response**: PDF file download

### Get Label
```http
GET /api/orders/:id/shipping-label
Authorization: Bearer <token>
```

**Roles**: Admin, Supplier (own orders), Reseller

**Response**: Label data

---

## 🔍 Example Scenarios

### Scenario 1: Generate Label for Prepaid Order
**Order**: Status = `confirmed`, Payment = `stripe`, Courier = `Delhivery`

**Flow**:
1. Validate order status ✅
2. Validate courier assigned ✅
3. Check no existing label ✅
4. Generate label number: `LBL-ABC-2024-0001`
5. Get pickup address from store tax profile
6. Get delivery address from order
7. Generate PDF with QR code (orderId)
8. Save label record
9. Emit event

**Result**: Label generated, PDF available for download

### Scenario 2: Generate Label for COD Order
**Order**: Status = `processing`, Payment = `cod`, Courier = `Delhivery`

**Flow**: Same as Scenario 1, plus:
- COD badge shown in red
- COD amount displayed prominently
- QR code encodes orderId

**Result**: Label with COD badge and amount

### Scenario 3: Duplicate Label Attempt
**Order**: Label already exists

**Flow**:
1. Validate order status ✅
2. Validate courier assigned ✅
3. Check existing label ❌ (found)

**Result**: Error: "Shipping label already exists for this order"

### Scenario 4: Ship Order Without Label
**Order**: Status = `processing`, No label

**Flow**:
1. Attempt to transition to `shipped`
2. Validation checks for label ❌

**Result**: Error: "Shipping label must be generated before order can be shipped"

---

## 🛡️ Safety Features

### ✅ Immutability
- Label frozen after generation
- No modifications allowed
- Cancellation creates new label (future feature)

### ✅ Uniqueness
- One active label per order
- Database constraint prevents duplicates
- Label number unique globally

### ✅ Validation
- Order status validation
- Courier assignment required
- No duplicate labels
- Address data snapshot (immutable)

### ✅ Access Control
- Admin: Full access
- Supplier: Own orders only
- Reseller: Read-only
- Store isolation enforced

### ✅ Audit Trail
- All label operations logged
- Includes: orderId, labelNumber, courierId, actor, IP
- Download tracking

---

## 📊 Label Data Sources

### Pickup Address
1. **Store Tax Profile** → `businessAddress` (preferred)
2. **Supplier Tax Profile** → `businessAddress` (fallback)
3. **Default** → Store name + default address

### Delivery Address
- **Order** → `shippingAddress` (snapshot at order creation)

### Package Details
- **Weight**: Calculated from order items (default 0.5 kg/item)
- **Dimensions**: Default or calculated from items (future)

### Order Details
- **Order Number**: From order
- **Item Count**: From order.items.length
- **COD Amount**: From order.codAmount or order.grandTotal
- **Prepaid Amount**: From order.grandTotal (if not COD)

---

## 🔄 Integration Points

### Order Creation
- Label not generated at order creation
- Generated on-demand when order is confirmed/processing

### Order Lifecycle
- **Processing**: Label can be generated
- **Shipped**: Label required (validation)

### Courier Integration
- Label uses `courierSnapshot` from order
- AWB number can be added when courier API is integrated
- QR code encodes AWB if available, else orderId

---

## 🎯 Best Practices

1. **Generate Early**: Generate label when order is confirmed
2. **Store Address**: Configure store tax profile with business address
3. **Supplier Address**: Configure supplier tax profile for accurate pickup
4. **QR Codes**: Use AWB number when available (from courier API)
5. **Print Quality**: Use 4x6 inch label printers
6. **Backup**: Store PDFs in S3/CDN for long-term access

---

## ❌ Common Mistakes (Avoided)

✅ **Not freezing label** - Immutable after generation
✅ **Not requiring before shipment** - Validation enforced
✅ **Not validating courier** - Required before generation
✅ **Not preventing duplicates** - Database constraint
✅ **Not snapshotting addresses** - Frozen in label record

---

## 🚀 Future Enhancements

1. **Courier API Integration**: Auto-generate AWB from Shiprocket/Delhivery
2. **Label Cancellation**: Cancel and regenerate labels
3. **Bulk Generation**: Generate labels for multiple orders
4. **Label Templates**: Courier-specific label formats
5. **S3/CDN Storage**: Long-term PDF storage
6. **Print Queue**: Batch printing support

---

## 📝 Summary

The Shipping Label Generation system provides:
- ✅ **Printable PDF labels** (4x6 inch)
- ✅ **Complete information** (courier, addresses, order, QR code)
- ✅ **Frozen after generation** (immutable)
- ✅ **Manual & API courier support**
- ✅ **Order lifecycle integration** (required before shipment)
- ✅ **Role-based access** (Admin, Supplier, Reseller)
- ✅ **Audit trail** (all operations logged)
- ✅ **Multi-tenant safe** (store isolation)

**This completes the shipping logistics chain: Shipping → Courier → Label.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

