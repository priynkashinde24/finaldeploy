# Multi-Origin Supplier Fulfillment Routing - Complete Guide

## 🎯 Overview

The Multi-Origin Supplier Fulfillment Routing system routes each order item to the best supplier origin (warehouse) based on availability, distance, shipping cost, and courier compatibility. It supports split shipments from multiple origins and freezes routing decisions at order creation.

---

## ✅ Architecture

### Fulfillment Routing Flow

```
Cart Items
  ↓
Fulfillment Engine
  ↓
For Each Item:
  1. Find origins with stock
  2. Calculate routing score
  3. Select best origin
  4. Assign courier
  ↓
Origin-Level Inventory Reservation
  ↓
Fulfillment Snapshot (frozen)
  ↓
Order Created
```

### Multi-Origin Support

- **Single Origin**: All items from one warehouse
- **Multi-Origin**: Items split across multiple warehouses
- **Shipment Groups**: One shipment per origin
- **Independent Lifecycle**: Each shipment tracked separately

---

## 📊 Data Models

### SupplierOrigin
```typescript
{
  supplierId: ObjectId,
  storeId: ObjectId,
  name: string,              // "Mumbai Warehouse"
  address: {
    country, state, city, pincode, street?
  },
  geo: {
    lat: number,             // Latitude
    lng: number              // Longitude
  },
  supportedCouriers: ObjectId[],
  priority: number,          // Lower = higher priority
  isActive: boolean
}
```

### OriginVariantInventory
```typescript
{
  supplierId: ObjectId,
  originId: ObjectId,
  globalVariantId: ObjectId,
  availableStock: number,
  reservedStock: number,
  totalStock: number
}
```

### FulfillmentSnapshot (in Order)
```typescript
{
  items: [
    {
      globalVariantId,
      quantity,
      supplierId,
      originId,
      originAddress: { name, country, state, city, pincode, street? },
      courierId?,
      shippingZoneId?,
      shippingCost?
    }
  ],
  shipmentGroups: [
    {
      originId,
      items: [{ globalVariantId, quantity }],
      shippingCost,
      courierId?,
      status: 'pending' | 'processing' | 'shipped' | 'delivered'
    }
  ],
  routedAt: Date
}
```

---

## 🔧 Fulfillment Routing Engine

### `routeFulfillment(params)`

**Parameters**:
- `cartItems[]`: Items to route
- `deliveryAddress`: Customer delivery address
- `storeId`: Store ID
- `paymentMethod`: Payment method (for courier selection)
- `orderValue`: Order value (for shipping calculation)

**Flow**:
1. **For each item**:
   - Find all origins with `availableStock >= quantity`
   - Filter to active origins only
   - Calculate routing score per origin
   - Select best origin (lowest score)

2. **Routing Score Calculation**:
   - **Distance (40%)**: Origin to delivery pincode
   - **Shipping Cost (30%)**: Calculated shipping cost
   - **Origin Priority (20%)**: Lower priority = better
   - **Courier Availability (10%)**: More couriers = better

3. **Courier Assignment**:
   - Assign courier per origin using `courierEngine`
   - Validate courier compatibility

4. **Shipment Grouping**:
   - Group items by origin
   - Calculate shipping cost per shipment
   - Return fulfillment snapshot

**Returns**:
- `items[]`: Routed items with origin assignment
- `shipmentGroups[]`: Grouped shipments by origin

---

## 🔄 Integration Points

### Order Creation

**Flow**:
1. Pricing resolution
2. **Fulfillment routing** (NEW)
3. **Origin-level inventory reservation** (UPDATED)
4. Shipping calculation (per origin or aggregate)
5. Tax calculation
6. Order persistence with fulfillment snapshot

**Changes**:
- `routeFulfillment()` called before inventory reservation
- Inventory reserved at origin level (not supplier level)
- Fulfillment snapshot stored in order

### Inventory Reservation

**Updated**:
- Supports `originId` in reservation items
- Reserves from `OriginVariantInventory` (if originId provided)
- Falls back to `SupplierVariantInventory` (legacy support)
- Reservation key: `(orderId + originId + variantId)`

---

## 🚀 Usage

### Single Origin Order
**Scenario**: All items available at one origin

**Result**:
- All items routed to same origin
- One shipment group
- Single shipping label

### Multi-Origin Order
**Scenario**: Items from different origins

**Result**:
- Items split across origins
- Multiple shipment groups
- Multiple shipping labels (one per origin)

### No Origin Available
**Scenario**: No origin has sufficient stock

**Result**:
- Routing fails
- Checkout blocked
- Clear error message

---

## 📋 Routing Score Factors

### 1. Distance (40% weight)
- **Calculation**: Pincode-based estimation or Haversine distance
- **Preference**: Closer origins = lower score

### 2. Shipping Cost (30% weight)
- **Calculation**: Actual shipping cost from origin to delivery
- **Preference**: Lower shipping cost = lower score

### 3. Origin Priority (20% weight)
- **Calculation**: Origin priority number
- **Preference**: Lower priority number = lower score

### 4. Courier Availability (10% weight)
- **Calculation**: Number of supported couriers
- **Preference**: More couriers = lower score

---

## 🛡️ Safety Features

### ✅ Origin Validation
- Only active origins considered
- Stock availability checked
- Never route to inactive origin

### ✅ Inventory Accuracy
- Origin-level stock tracking
- Atomic reservation per origin
- Never oversell origin inventory

### ✅ Immutability
- Routing decision frozen at order creation
- Fulfillment snapshot never modified
- Audit trail preserved

### ✅ Multi-Tenancy
- Store isolation enforced
- Origins are store-specific
- No cross-store routing

---

## 🔍 Example Scenarios

### Scenario 1: Single Origin Order
**Items**: 2x Product A, 1x Product B
**Origins**: 
- Mumbai: Product A (10), Product B (5)
- Delhi: Product A (20), Product B (0)

**Routing**:
- Product A → Mumbai (closer to delivery)
- Product B → Mumbai (only option)

**Result**: Single shipment from Mumbai

### Scenario 2: Multi-Origin Order
**Items**: 2x Product A, 1x Product B
**Origins**:
- Mumbai: Product A (1), Product B (5)
- Delhi: Product A (20), Product B (0)

**Routing**:
- Product A → Delhi (Mumbai insufficient stock)
- Product B → Mumbai (only option)

**Result**: Two shipments (Delhi + Mumbai)

### Scenario 3: No Origin Available
**Items**: 5x Product A
**Origins**:
- Mumbai: Product A (3)
- Delhi: Product A (2)

**Routing**: Fails (no origin has 5 units)

**Result**: Checkout blocked with error

---

## 🎯 Best Practices

1. **Origin Setup**: Configure origins with accurate geo coordinates
2. **Inventory Sync**: Keep origin inventory up-to-date
3. **Courier Configuration**: Assign supported couriers to origins
4. **Priority Tuning**: Set origin priorities based on SLA/cost
5. **Distance Calculation**: Use geocoding API for accurate distances

---

## ❌ Common Mistakes (Avoided)

✅ **Not checking origin stock** - Stock validated before routing
✅ **Not considering distance** - Distance included in score
✅ **Not supporting multi-origin** - Shipment groups implemented
✅ **Not freezing routing** - Snapshot immutable after creation
✅ **Not tracking per-origin** - Origin-level inventory tracking

---

## 🚀 Future Enhancements

1. **SLA-Based Routing**: Consider delivery time promises
2. **Cost Optimization**: Minimize total shipping cost across origins
3. **Inventory Balancing**: Distribute load across origins
4. **Real-Time Distance**: Integrate with geocoding API
5. **Origin Capacity**: Consider origin processing capacity
6. **Split Optimization**: Optimize split shipments for cost/time

---

## 📝 Summary

The Multi-Origin Supplier Fulfillment Routing system provides:
- ✅ **Intelligent routing** to best origin per item
- ✅ **Multi-origin support** with split shipments
- ✅ **Origin-level inventory** tracking and reservation
- ✅ **Distance and cost optimization** in routing
- ✅ **Frozen routing decisions** at order creation
- ✅ **Shipment groups** for multi-origin orders
- ✅ **Courier compatibility** validation
- ✅ **Audit logging** for all routing decisions

**This completes the fulfillment intelligence layer: Cart → Routing → Origin Selection → Inventory Reservation → Order Creation.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

