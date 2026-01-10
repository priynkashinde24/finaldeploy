# Marketplace Backend - Complete System Architecture

## 🎯 Executive Summary

This document provides a comprehensive overview of the complete marketplace backend system, covering all major subsystems, their interactions, and the mental models that drive the architecture.

**Built for**: Multi-tenant marketplace with suppliers, resellers, and customers  
**Scale**: Production-ready, enterprise-grade  
**Philosophy**: Deterministic, snapshot-based, immutable, auditable

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKETPLACE BACKEND                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Pricing    │  │    Tax       │  │  Shipping     │    │
│  │   Engine     │→ │   Engine     │→ │  Engine      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         ↓                 ↓                 ↓              │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Fulfillment Routing Engine                │    │
│  │  (Multi-Origin Supplier Selection)                │    │
│  └──────────────────────────────────────────────────┘    │
│         ↓                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Courier    │  │  Inventory   │  │   Order      │    │
│  │   Mapping    │  │ Reservation  │  │  Creation    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         ↓                 ↓                 ↓              │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Order Lifecycle Engine                    │    │
│  │  (Status Transitions + Side Effects)              │    │
│  └──────────────────────────────────────────────────┘    │
│         ↓                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Shipping   │  │   Courier    │  │   Order      │    │
│  │   Label      │  │   Tracking   │  │  Tracking    │    │
│  │   Generation │  │   Sync      │  │  Page        │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Subsystems

### 1. Pricing Engine
**Purpose**: Calculate final selling price with rules, discounts, markups

**Key Components**:
- Pricing rules (store-level, product-level)
- Markup rules (reseller margins)
- Discount engine (coupons, promotions)
- Store price overrides

**Mental Model**: `Base Price → Rules → Markup → Discount → Final Price`

**Snapshot**: Price frozen at order creation

---

### 2. Tax Engine
**Purpose**: Calculate taxes (GST/VAT) deterministically

**Key Components**:
- Tax profiles (store, supplier, reseller, platform)
- Place of supply determination
- Tax rate calculation
- Tax breakup (CGST/SGST/IGST/VAT)

**Mental Model**: `Address → Place of Supply → Tax Profile → Tax Rate → Tax Amount`

**Snapshot**: Tax calculation frozen in `order.taxSnapshot`

---

### 3. Shipping Rate Engine
**Purpose**: Calculate shipping costs based on zones and rate slabs

**Key Components**:
- Shipping zones (pincode/state/country)
- Shipping rate slabs (weight/order value)
- COD surcharge handling
- Free shipping rules

**Mental Model**: `Address → Zone → Rate Slab → Shipping Cost`

**Snapshot**: Shipping calculation frozen in `order.shippingSnapshot`

---

### 4. Fulfillment Routing Engine ⭐ NEW
**Purpose**: Route each order item to the best supplier origin (warehouse)

**Key Components**:
- Supplier origins (warehouses)
- Origin-level inventory
- Routing algorithm (distance, cost, priority, courier)
- Multi-origin support

**Mental Model**: `Item → Origins with Stock → Score → Best Origin → Shipment Group`

**Snapshot**: Routing decision frozen in `order.fulfillmentSnapshot`

**Key Innovation**: Order ≠ Shipment (one order can have multiple shipments)

---

### 5. Courier Mapping Engine
**Purpose**: Assign appropriate courier to orders based on rules

**Key Components**:
- Courier master data
- Courier rules (zone, payment, weight, value)
- Priority-based selection
- Fallback courier

**Mental Model**: `Zone + Order → Courier Rules → Validated Courier → Snapshot`

**Snapshot**: Courier assignment frozen in `order.courierSnapshot`

---

### 6. Inventory Reservation System
**Purpose**: Prevent overselling with atomic reservations

**Key Components**:
- Variant-level inventory
- Origin-level inventory (NEW)
- Reservation model
- TTL-based expiration

**Mental Model**: `Checkout → Reserve → Confirm → Consume`

**Key Innovation**: Origin-level reservations for multi-origin orders

---

### 7. Order Creation Engine
**Purpose**: Create orders atomically with all calculations

**Flow**:
1. Pricing resolution
2. **Fulfillment routing** (NEW)
3. **Origin-level inventory reservation** (NEW)
4. Shipping calculation
5. Tax calculation
6. Courier assignment
7. Order persistence

**Mental Model**: `Cart → Validate → Calculate → Reserve → Create → Pay`

**Key Innovation**: Multi-origin routing integrated into order creation

---

### 8. Order Lifecycle Engine
**Purpose**: Manage order status transitions safely

**Key Components**:
- State machine (valid transitions)
- Side effects (inventory, payouts, invoices)
- Role-based permissions
- Status history tracking

**Mental Model**: `Status → Validate Transition → Apply Side Effects → Update Status`

**Key Innovation**: Status history for timeline rendering

---

### 9. Shipping Label Generation
**Purpose**: Generate printable PDF labels for shipments

**Key Components**:
- Label number generator
- PDF template (4x6 inch)
- QR code generation
- Multi-origin label support (NEW)

**Mental Model**: `Order → Validate → Generate PDF → Save Label → Download`

**Key Innovation**: One label per shipment (not per order)

---

### 10. Courier API Integration
**Purpose**: Sync real-time tracking from courier APIs

**Key Components**:
- Shiprocket API client
- Delhivery API client
- Webhook handlers
- Status mapping

**Mental Model**: `Courier API → Webhook → Sync Status → Update Order`

**Key Innovation**: Automatic order status updates from courier tracking

---

### 11. Order Tracking System
**Purpose**: Customer-facing order status visibility

**Key Components**:
- Status history timeline
- Courier tracking links
- Real-time updates
- Public tracking support

**Mental Model**: `Order → Status History → Timeline → Customer View`

**Key Innovation**: Derived from status history (not current status)

---

## 🔄 Data Flow: Complete Order Journey

### Phase 1: Cart to Order
```
Customer Cart
  ↓
Pricing Engine (calculate prices)
  ↓
Fulfillment Routing (select origins)
  ↓
Origin-Level Inventory Reservation
  ↓
Shipping Calculation (per origin)
  ↓
Tax Calculation
  ↓
Courier Assignment (per origin)
  ↓
Order Created (with snapshots)
```

### Phase 2: Order to Shipment
```
Order (confirmed)
  ↓
Shipment Groups (one per origin)
  ↓
For Each Shipment:
  - Generate Shipping Label
  - Assign Courier
  - Update Status: processing → shipped
```

### Phase 3: Shipment to Delivery
```
Shipment Shipped
  ↓
Courier API Tracking
  ↓
Status Updates (webhook/polling)
  ↓
Order Status: shipped → out_for_delivery → delivered
  ↓
All Shipments Delivered → Order Delivered
```

---

## 📊 Key Data Models

### Order
```typescript
{
  // Identifiers
  orderId, orderNumber, storeId, customerId
  
  // Items
  items: [{ globalVariantId, quantity, price, ... }]
  
  // Financials
  totalAmount, subtotal, taxTotal, grandTotal
  
  // Snapshots (IMMUTABLE)
  taxSnapshot: { ... },
  shippingSnapshot: { ... },
  courierSnapshot: { ... },
  fulfillmentSnapshot: {  // NEW
    items: [{ originId, originAddress, ... }],
    shipmentGroups: [{ originId, items, shippingCost, ... }]
  }
  
  // Lifecycle
  orderStatus, paymentStatus, inventoryStatus
}
```

### Fulfillment Snapshot (NEW)
```typescript
{
  items: [
    {
      globalVariantId,
      quantity,
      supplierId,
      originId,              // Which warehouse
      originAddress,         // Frozen address
      courierId,             // Assigned courier
      shippingZoneId,        // Delivery zone
      shippingCost           // Per-item shipping
    }
  ],
  shipmentGroups: [
    {
      originId,              // Shipment from this origin
      items: [...],          // Items in this shipment
      shippingCost,          // Total shipping for shipment
      courierId,             // Courier for this shipment
      status                 // Shipment lifecycle
    }
  ],
  routedAt: Date            // When routing decision was made
}
```

### Supplier Origin
```typescript
{
  supplierId,
  storeId,
  name,                     // "Mumbai Warehouse"
  address: { country, state, city, pincode },
  geo: { lat, lng },        // For distance calculation
  supportedCouriers: [],    // Which couriers service this origin
  priority,                 // Routing priority
  isActive
}
```

### Origin Variant Inventory
```typescript
{
  supplierId,
  originId,                 // Which warehouse
  globalVariantId,
  availableStock,           // Available at this origin
  reservedStock,           // Reserved at this origin
  totalStock
}
```

---

## 🎯 Mental Models

### 1. Order ≠ Shipment
**Key Insight**: One order can have multiple shipments from different origins

**Example**:
- Order: 2x Product A, 1x Product B
- Shipment 1: Product A (from Mumbai origin)
- Shipment 2: Product B (from Delhi origin)

**Benefits**:
- Nearest-origin fulfillment
- Faster delivery
- Lower shipping costs
- True marketplace scalability

---

### 2. Snapshot-Based Calculations
**Key Insight**: All calculations frozen at order creation, never recalculated

**Snapshots**:
- `taxSnapshot`: Tax calculation frozen
- `shippingSnapshot`: Shipping cost frozen
- `courierSnapshot`: Courier assignment frozen
- `fulfillmentSnapshot`: Origin routing frozen

**Benefits**:
- Deterministic invoices
- Audit trail
- No price changes after order
- Invoice-ready data

---

### 3. Origin-Level Inventory
**Key Insight**: Inventory tracked per warehouse, not per supplier globally

**Flow**:
- Supplier has multiple origins (warehouses)
- Each origin has its own inventory
- Reservations at origin level
- Prevents overselling per origin

**Benefits**:
- Accurate stock tracking
- Multi-warehouse support
- Better fulfillment routing

---

### 4. Status History Timeline
**Key Insight**: Timeline derived from status history, not current status

**Flow**:
- Every status change logged in `OrderStatusHistory`
- Timeline built from history records
- Current status marked in timeline
- Immutable audit trail

**Benefits**:
- Accurate timeline
- Audit compliance
- Customer transparency

---

## 🔐 Security & Multi-Tenancy

### Store Isolation
- All queries filtered by `storeId`
- No cross-store data access
- Store-specific configurations

### Role-Based Access
- **Admin**: Full access
- **Supplier**: Own products/orders
- **Reseller**: Own store orders
- **Customer**: Own orders only

### Data Masking
- Public tracking: Sensitive data masked
- Supplier costs: Never exposed to resellers
- Internal IDs: Never exposed to customers

---

## 📈 Scalability Features

### 1. Multi-Origin Fulfillment
- Route to nearest origin
- Split shipments across origins
- Independent shipment lifecycles

### 2. Origin-Level Inventory
- Accurate stock tracking
- Prevents overselling
- Supports multiple warehouses

### 3. Snapshot-Based Architecture
- No recalculation overhead
- Fast order retrieval
- Deterministic results

### 4. Event-Driven Updates
- Webhook-based courier tracking
- Real-time status updates
- Asynchronous processing

---

## 🔄 Integration Points

### Order Creation → Fulfillment Routing
- Routing happens before inventory reservation
- Origin selected per item
- Shipment groups created

### Fulfillment Routing → Inventory Reservation
- Reservations at origin level
- Stock checked per origin
- Atomic reservation per origin

### Order Creation → Shipping Label
- Label generated per shipment
- One label per origin
- Label references origin address

### Courier API → Order Status
- Webhook receives tracking updates
- Status mapped to order status
- Order updated automatically

---

## 📋 API Endpoints Summary

### Order Management
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order
- `PATCH /api/orders/:id/status` - Update status

### Fulfillment
- `GET /api/orders/:id/fulfillment` - Get fulfillment details
- `POST /api/orders/:id/shipping-label` - Generate label
- `GET /api/shipping-labels/:id/download` - Download label

### Tracking
- `GET /api/orders/:orderNumber/track` - Track order
- `GET /api/orders/:orderNumber/track/public` - Public tracking

### Courier Integration
- `POST /api/webhooks/courier/:courierId` - Courier webhook
- `POST /api/webhooks/courier/shiprocket` - Shiprocket webhook
- `POST /api/webhooks/courier/delhivery` - Delhivery webhook

### Admin APIs
- `POST /api/admin/couriers` - Create courier
- `POST /api/admin/courier-rules` - Create courier rule
- `POST /api/admin/shipping/zones` - Create shipping zone
- `POST /api/admin/shipping/rates` - Create shipping rate

---

## 🎯 Key Innovations

### 1. Multi-Origin Fulfillment Routing
- **Problem**: Single origin assumption limits scalability
- **Solution**: Route each item to best origin
- **Impact**: Nearest-origin fulfillment, faster delivery, lower costs

### 2. Origin-Level Inventory
- **Problem**: Global inventory doesn't reflect warehouse reality
- **Solution**: Track inventory per origin
- **Impact**: Accurate stock, prevents overselling, multi-warehouse support

### 3. Snapshot-Based Architecture
- **Problem**: Recalculations cause inconsistencies
- **Solution**: Freeze all calculations at order creation
- **Impact**: Deterministic invoices, audit trail, no price changes

### 4. Order ≠ Shipment Separation
- **Problem**: One label per order doesn't scale
- **Solution**: One shipment per origin, multiple shipments per order
- **Impact**: True marketplace scalability, Amazon-level routing

### 5. Status History Timeline
- **Problem**: Current status doesn't show history
- **Solution**: Log all transitions, build timeline from history
- **Impact**: Accurate timeline, audit compliance, customer transparency

---

## 🚀 Production Readiness

### ✅ Completed Systems
1. ✅ Pricing Engine (rules, markups, discounts)
2. ✅ Tax Engine (GST/VAT calculation)
3. ✅ Shipping Rate Engine (zones, slabs, COD)
4. ✅ Fulfillment Routing Engine (multi-origin)
5. ✅ Courier Mapping Engine (rule-based assignment)
6. ✅ Inventory Reservation (origin-level)
7. ✅ Order Creation (atomic, snapshot-based)
8. ✅ Order Lifecycle (state machine, side effects)
9. ✅ Shipping Label Generation (PDF, QR codes)
10. ✅ Courier API Integration (Shiprocket, Delhivery)
11. ✅ Order Tracking (timeline, public tracking)
12. ✅ Audit Logging (all operations)

### ✅ Safety Features
- ✅ Store isolation (multi-tenancy)
- ✅ Role-based access control
- ✅ Atomic transactions
- ✅ Idempotent operations
- ✅ Immutable snapshots
- ✅ Audit trails

### ✅ Scalability Features
- ✅ Multi-origin fulfillment
- ✅ Origin-level inventory
- ✅ Split shipments
- ✅ Event-driven updates
- ✅ Webhook-based tracking

---

## 📊 System Metrics

### Order Processing
- **Throughput**: Handles concurrent orders
- **Latency**: Sub-second order creation
- **Accuracy**: 100% deterministic calculations

### Inventory Management
- **Precision**: Origin-level stock tracking
- **Safety**: Atomic reservations prevent overselling
- **Scale**: Supports unlimited origins per supplier

### Fulfillment Routing
- **Intelligence**: Multi-factor scoring (distance, cost, priority, courier)
- **Flexibility**: Supports single and multi-origin orders
- **Optimization**: Nearest-origin selection

---

## 🔮 Future Enhancements (Optional)

### Advanced Routing
- SLA-based routing (fastest vs cheapest)
- Dynamic origin re-routing (before shipment)
- Warehouse capacity limits
- Fulfillment analytics & heatmaps

### Performance
- Caching layer for frequently accessed data
- Background jobs for heavy operations
- Database indexing optimization
- Query performance tuning

### Features
- Returns tracking page
- Delivery ETA prediction
- SMS/WhatsApp notifications
- Advanced analytics dashboard

---

## 📝 Summary

This marketplace backend provides:

✅ **Complete Order Lifecycle**: Cart → Order → Shipment → Delivery  
✅ **Multi-Origin Fulfillment**: Intelligent routing to best origins  
✅ **Deterministic Calculations**: All snapshots frozen at creation  
✅ **Scalable Architecture**: Order ≠ Shipment separation  
✅ **Real-Time Tracking**: Courier API integration  
✅ **Production-Ready**: Safety, security, auditability built-in  

**This is a full-scale, enterprise-grade marketplace backend ready for production deployment.**

---

*Last Updated: 2024-01-15*  
*Version: 1.0.0*  
*Architecture: Multi-tenant, Snapshot-based, Event-driven*

