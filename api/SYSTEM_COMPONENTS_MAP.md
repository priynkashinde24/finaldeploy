# System Components Map - Quick Reference

## 🗺️ Component Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    FOUNDATION LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  • Multi-Tenant Store Model                                 │
│  • User Management (Admin, Supplier, Reseller, Customer)     │
│  • Authentication & Authorization                           │
│  • Audit Logging System                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    CATALOG LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  • Global Product/Variant Models                            │
│  • Supplier Catalog                                         │
│  • Reseller Catalog (synced view)                           │
│  • Variant & Inventory Automation                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    PRICING LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  • Pricing Engine (rules, markups)                          │
│  • Discount Engine (coupons, promotions)                    │
│  • Store Price Override                                     │
│  • Final Price Calculation                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    FULFILLMENT LAYER ⭐                      │
├─────────────────────────────────────────────────────────────┤
│  • Supplier Origins (warehouses)                            │
│  • Origin Variant Inventory                                 │
│  • Fulfillment Routing Engine                               │
│  • Multi-Origin Support                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    LOGISTICS LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  • Shipping Zone Model                                      │
│  • Shipping Rate Engine                                     │
│  • Courier Master & Rules                                   │
│  • Courier Mapping Engine                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    ORDER LAYER                               │
├─────────────────────────────────────────────────────────────┤
│  • Order Creation Engine                                    │
│  • Inventory Reservation (origin-level)                     │
│  • Tax Engine                                               │
│  • Order Lifecycle Engine                                   │
│  • Order Status History                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SHIPMENT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  • Shipping Label Generation                                │
│  • Courier API Integration                                  │
│  • Tracking Sync Service                                    │
│  • Order Tracking Page                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    FINANCIAL LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  • Payment Integration (Stripe, PayPal, COD)                │
│  • Invoice Generation                                       │
│  • Payout Calculation                                       │
│  • Financial Reports                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 File Structure

### Models (`/api/src/models/`)
```
Order.ts                    # Order model with all snapshots
SupplierOrigin.ts           # Warehouse/origin locations
OriginVariantInventory.ts   # Per-origin inventory
InventoryReservation.ts     # Origin-level reservations
ShippingZone.ts             # Shipping zones
ShippingRate.ts             # Rate slabs
Courier.ts                  # Courier master data
CourierRule.ts              # Courier assignment rules
ShippingLabel.ts            # Generated labels
OrderStatusHistory.ts       # Status transition history
```

### Services (`/api/src/services/`)
```
orderCreation.service.ts    # Order creation with routing
inventoryReservation.service.ts  # Origin-level reservations
orderLifecycle.service.ts   # Status transitions
shippingLabel.service.ts   # Label generation
courierTrackingSync.service.ts  # Courier API sync
orderTracking.service.ts    # Tracking data aggregation
```

### Utils (`/api/src/utils/`)
```
fulfillmentEngine.ts        # Multi-origin routing
shippingEngine.ts          # Shipping cost calculation
courierEngine.ts            # Courier assignment
taxEngine.ts               # Tax calculation
pricingEngine.ts            # Price resolution
labelNumber.ts              # Label number generation
orderNumber.ts              # Order number generation
```

### Controllers (`/api/src/controllers/`)
```
orderTracking.controller.ts      # Tracking endpoints
shippingLabel.controller.ts      # Label endpoints
courierWebhook.controller.ts     # Courier webhooks
adminCourier.controller.ts       # Courier management
adminShipping.controller.ts      # Shipping management
```

---

## 🔄 Data Flow Diagrams

### Order Creation Flow
```
Cart Items
  → Pricing Resolution
  → Fulfillment Routing (select origins)
  → Origin-Level Inventory Reservation
  → Shipping Calculation (per origin)
  → Tax Calculation
  → Courier Assignment (per origin)
  → Order Persistence (with snapshots)
  → Payment Handoff
```

### Fulfillment Routing Flow
```
Cart Item
  → Find Origins with Stock
  → Calculate Score (distance, cost, priority, courier)
  → Select Best Origin
  → Assign Courier
  → Create Shipment Group
```

### Shipment Lifecycle Flow
```
Order Created
  → Shipment Groups Created
  → For Each Shipment:
      → Generate Shipping Label
      → Update Status: processing
      → Ship: processing → shipped
      → Courier Tracking: shipped → out_for_delivery → delivered
  → All Shipments Delivered → Order Delivered
```

---

## 🎯 Key Design Patterns

### 1. Snapshot Pattern
**Purpose**: Freeze calculations at order creation

**Used In**:
- Tax calculations
- Shipping calculations
- Courier assignments
- Fulfillment routing

**Benefits**: Deterministic, immutable, audit-ready

---

### 2. Factory Pattern
**Purpose**: Create appropriate instances based on configuration

**Used In**:
- Courier API clients (Shiprocket, Delhivery)
- Payment providers (Stripe, PayPal)

**Benefits**: Extensible, maintainable

---

### 3. State Machine Pattern
**Purpose**: Control order status transitions

**Used In**:
- Order lifecycle engine
- Status validation
- Side effect coordination

**Benefits**: Safe transitions, predictable behavior

---

### 4. Repository Pattern
**Purpose**: Abstract data access

**Used In**:
- Model queries
- Transaction management
- Data validation

**Benefits**: Testable, maintainable

---

## 🔐 Security Architecture

### Multi-Tenancy
- **Store Isolation**: All queries filtered by `storeId`
- **Data Segregation**: No cross-store access
- **Configuration Isolation**: Store-specific settings

### Access Control
- **Role-Based**: Admin, Supplier, Reseller, Customer
- **Resource-Based**: Own resources only
- **Public Endpoints**: Rate-limited, verified

### Data Protection
- **Sensitive Data**: Never exposed in responses
- **Internal IDs**: Mapped to public identifiers
- **Audit Trail**: All operations logged

---

## 📊 Performance Considerations

### Database Indexing
- **Compound Indexes**: Store + Entity queries
- **Status Indexes**: Fast status filtering
- **Timestamp Indexes**: Timeline queries

### Query Optimization
- **Lean Queries**: Minimize data transfer
- **Populate Selectively**: Only needed fields
- **Batch Operations**: Group related queries

### Caching Opportunities
- **Tax Profiles**: Rarely change
- **Shipping Zones**: Configuration data
- **Courier Rules**: Rule matching

---

## 🧪 Testing Strategy

### Unit Tests
- **Engines**: Pricing, tax, shipping, fulfillment
- **Services**: Order creation, lifecycle, reservation
- **Utils**: Number generators, calculations

### Integration Tests
- **Order Creation**: End-to-end flow
- **Fulfillment Routing**: Multi-origin scenarios
- **Courier Integration**: API sync

### E2E Tests
- **Checkout Flow**: Cart to order
- **Tracking Flow**: Status updates
- **Label Generation**: PDF creation

---

## 📈 Monitoring & Observability

### Key Metrics
- **Order Creation Rate**: Orders per minute
- **Routing Success Rate**: % of items routed
- **Label Generation Time**: PDF creation latency
- **Tracking Sync Rate**: Courier API success rate

### Logging
- **Audit Logs**: All operations
- **Error Logs**: Failures and exceptions
- **Performance Logs**: Slow queries, operations

### Alerts
- **Routing Failures**: No origin available
- **Inventory Issues**: Overselling attempts
- **API Failures**: Courier API errors

---

## 🚀 Deployment Checklist

### Pre-Production
- [ ] Database indexes created
- [ ] Environment variables configured
- [ ] Courier API credentials set
- [ ] Webhook URLs configured
- [ ] Rate limiting configured
- [ ] Audit logging enabled

### Production
- [ ] Multi-tenant isolation verified
- [ ] Origin inventory synced
- [ ] Shipping zones configured
- [ ] Courier rules configured
- [ ] Label generation tested
- [ ] Tracking integration verified

### Post-Deployment
- [ ] Monitor order creation rate
- [ ] Monitor routing success rate
- [ ] Monitor label generation
- [ ] Monitor tracking sync
- [ ] Review audit logs
- [ ] Performance tuning

---

## 📚 Documentation Index

1. **SHIPPING_ENGINE_COMPLETE.md** - Shipping rate calculation
2. **COURIER_MAPPING_COMPLETE.md** - Courier assignment logic
3. **SHIPPING_LABEL_COMPLETE.md** - Label generation system
4. **COURIER_API_TRACKING_COMPLETE.md** - Courier API integration
5. **ORDER_TRACKING_COMPLETE.md** - Order tracking system
6. **MULTI_ORIGIN_FULFILLMENT_COMPLETE.md** - Fulfillment routing
7. **SYSTEM_ARCHITECTURE_COMPLETE.md** - This document

---

*Last Updated: 2024-01-15*  
*Version: 1.0.0*

