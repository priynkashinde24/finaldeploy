# Courier Mapping & Assignment Logic - Complete Guide

## 🧠 Mental Model

```
Address → Zone → Zone + Order → Courier Rule → Courier → Frozen Snapshot
```

**Courier assignment is policy-driven, not random.**

---

## ✅ Architecture Overview

### 1. **Address → Zone Resolution**
- Uses shipping zone from shipping engine
- Zone determined by: pincode → state → country
- Zone ID passed to courier engine

### 2. **Zone + Order → Courier Rule Matching**
- **Filters**: Payment method, weight range, order value range
- **Priority**: Lower priority number = higher priority
- **Multiple rules**: All matching rules evaluated, highest priority wins

### 3. **Courier Rule → Courier Selection**
- Rule contains `courierId` reference
- Courier validated: active, COD support, zone serviceability, weight limits
- Fallback: Default courier if no rules match

### 4. **Courier → Frozen Snapshot**
- **Immutable**: Calculated once at order creation
- **Never reassigned automatically**: Frozen after assignment
- **Complete breakdown**: courierId, courierName, courierCode, ruleId, reason

---

## 📊 Data Models

### Courier
```typescript
{
  storeId: ObjectId,
  name: string,              // e.g. "Delhivery", "Shiprocket", "BlueDart"
  code: string,              // Unique code: "DEL", "SR", "BD"
  supportsCOD: boolean,      // Whether courier supports COD
  maxWeight: number,         // Max weight in kg (0 = no limit)
  serviceableZones: ObjectId[], // Zone IDs this courier can service
  serviceablePincodes?: string[], // Optional: specific pincodes
  priority: number,          // Lower = higher priority (1 = highest)
  isActive: boolean
}
```

### CourierRule
```typescript
{
  storeId: ObjectId,
  zoneId: ObjectId,
  paymentMethod: 'prepaid' | 'cod' | 'both',
  minWeight?: number,        // Optional: minimum weight in kg
  maxWeight?: number,        // Optional: maximum weight in kg
  minOrderValue?: number,    // Optional: minimum order value
  maxOrderValue?: number,    // Optional: maximum order value
  courierId: ObjectId,
  priority: number,          // Lower = higher priority
  isActive: boolean
}
```

### CourierSnapshot (in Order)
```typescript
{
  courierId: ObjectId,
  courierName: string,
  courierCode: string,
  ruleId?: ObjectId | null,  // null if default/manual assignment
  assignedAt: Date,
  reason: string             // Rule match explanation
}
```

---

## 🔧 Configuration Guide

### Step 1: Create Couriers

**API**: `POST /api/admin/couriers`

```json
{
  "name": "Delhivery",
  "code": "DEL",
  "supportsCOD": true,
  "maxWeight": 30,
  "serviceableZones": ["zone_id_1", "zone_id_2"],
  "serviceablePincodes": ["400001", "400002"],
  "priority": 1,
  "isActive": true
}
```

**Example Couriers:**
- **Delhivery**: COD support, 30kg max, Priority 1
- **Shiprocket**: COD support, 20kg max, Priority 2
- **BlueDart**: No COD, 10kg max, Priority 3
- **Local Courier**: COD support, 5kg max, Priority 1 (for local zone)

### Step 2: Create Courier Rules

**API**: `POST /api/admin/courier-rules`

#### Example 1: COD Orders → Delhivery
```json
{
  "zoneId": "zone_id_local",
  "paymentMethod": "cod",
  "minWeight": 0,
  "maxWeight": 30,
  "minOrderValue": 0,
  "maxOrderValue": 999999,
  "courierId": "delhivery_id",
  "priority": 1,
  "isActive": true
}
```
**Meaning**: COD orders in Local zone → Delhivery (highest priority)

#### Example 2: Heavy Orders → Shiprocket
```json
{
  "zoneId": "zone_id_local",
  "paymentMethod": "both",
  "minWeight": 10,
  "maxWeight": 20,
  "minOrderValue": 0,
  "maxOrderValue": 999999,
  "courierId": "shiprocket_id",
  "priority": 2,
  "isActive": true
}
```
**Meaning**: Orders 10-20 kg → Shiprocket (medium priority)

#### Example 3: High Value Orders → BlueDart
```json
{
  "zoneId": "zone_id_local",
  "paymentMethod": "prepaid",
  "minWeight": 0,
  "maxWeight": 10,
  "minOrderValue": 10000,
  "maxOrderValue": 999999,
  "courierId": "bluedart_id",
  "priority": 1,
  "isActive": true
}
```
**Meaning**: Prepaid orders above ₹10,000 → BlueDart (highest priority)

### Step 3: Rule Priority Logic

**Priority Sorting:**
1. **Rule Priority** (lower = higher priority)
2. **Courier Priority** (lower = higher priority)

**Example:**
- Rule A: Priority 1, Courier Priority 2
- Rule B: Priority 2, Courier Priority 1
- **Winner**: Rule A (rule priority wins)

---

## 🚀 Usage in Order Creation

### Automatic Integration

Courier is **automatically assigned** during order creation:

```typescript
// In orderCreation.service.ts
// After shipping calculation:
const courierResult = await assignCourier({
  storeId: storeObjId,
  shippingZoneId: shippingResult.snapshot.zoneId,
  orderWeight: 2.5,        // kg
  orderValue: 2500,        // ₹ (subtotal)
  paymentMethod: "cod",    // or "stripe", "paypal"
  shippingPincode: "400001"
});

// Snapshot stored in order
order.courierSnapshot = courierResult.snapshot;
```

### Assignment Flow

```
1. Shipping zone resolved (from shipping engine)
2. Fetch courier rules for zone
3. Filter rules by:
   - Payment method (prepaid/cod/both)
   - Weight range (minWeight ≤ orderWeight < maxWeight)
   - Order value range (minOrderValue ≤ orderValue < maxOrderValue)
4. Validate courier:
   - Active
   - Supports COD (if COD order)
   - Services zone
   - Within weight limit
5. Sort by priority (rule → courier)
6. Select first match
7. Create frozen snapshot
```

---

## ⚠️ Validation Rules

### 1. Courier Validation
- **Active**: Only active couriers assigned
- **COD Support**: COD orders require `supportsCOD = true`
- **Zone Serviceability**: Courier must service order's zone
- **Weight Limit**: Order weight ≤ courier.maxWeight (if maxWeight > 0)

### 2. Rule Matching
- **Payment Method**: Rule must match order payment method
- **Weight Range**: Order weight must be within rule's weight range
- **Order Value Range**: Order value must be within rule's value range

### 3. Lifecycle Protection
- **Processing**: Courier locked (cannot change)
- **Shipped**: Courier required (cannot ship without courier)
- **Manual Override**: Allowed only before shipment

### 4. Fallback Logic
- **No Rules Match**: Try default courier (lowest priority, services zone)
- **No Default**: Checkout blocked with error

---

## 📋 API Endpoints

### Couriers

#### Create Courier
```http
POST /api/admin/couriers
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Delhivery",
  "code": "DEL",
  "supportsCOD": true,
  "maxWeight": 30,
  "serviceableZones": ["zone_id"],
  "priority": 1,
  "isActive": true
}
```

#### List Couriers
```http
GET /api/admin/couriers?isActive=true
Authorization: Bearer <admin_token>
```

#### Update Courier
```http
PATCH /api/admin/couriers/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Courier Rules

#### Create Rule
```http
POST /api/admin/courier-rules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "zoneId": "zone_id",
  "paymentMethod": "cod",
  "minWeight": 0,
  "maxWeight": 30,
  "courierId": "courier_id",
  "priority": 1,
  "isActive": true
}
```

#### List Rules
```http
GET /api/admin/courier-rules?zoneId=zone_id&paymentMethod=cod
Authorization: Bearer <admin_token>
```

#### Update Rule
```http
PATCH /api/admin/courier-rules/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "priority": 2
}
```

### Manual Assignment

#### Assign Courier to Order
```http
PATCH /api/admin/orders/:id/assign-courier
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "courierId": "courier_id",
  "reason": "Manual override - Delhivery unavailable"
}
```

**Rules:**
- Only allowed if `orderStatus < shipped`
- Old snapshot preserved in audit log
- Validates courier (active, COD support, zone)

---

## 🔍 Example Scenarios

### Scenario 1: COD Order → Delhivery
**Zone**: "Local" (Mumbai)
**Order**: 3 kg, ₹2500, COD payment
**Rules**:
- Rule 1: COD, 0-30kg → Delhivery (Priority 1)
- Rule 2: COD, 0-30kg → Shiprocket (Priority 2)

**Result**:
- Rule 1 matches (COD, weight in range)
- Delhivery validated (active, supports COD, services zone, within weight)
- **Assigned**: Delhivery (Rule 1, Priority 1)

### Scenario 2: Heavy Prepaid Order → Shiprocket
**Zone**: "Local"
**Order**: 15 kg, ₹5000, Stripe payment
**Rules**:
- Rule 1: Both, 0-10kg → Delhivery (Priority 1)
- Rule 2: Both, 10-20kg → Shiprocket (Priority 2)

**Result**:
- Rule 1 doesn't match (weight 15kg > 10kg)
- Rule 2 matches (prepaid, weight 15kg in 10-20kg range)
- Shiprocket validated
- **Assigned**: Shiprocket (Rule 2, Priority 2)

### Scenario 3: High Value Order → BlueDart
**Zone**: "Local"
**Order**: 2 kg, ₹15000, Stripe payment
**Rules**:
- Rule 1: Prepaid, ₹10000+ → BlueDart (Priority 1)
- Rule 2: Both, 0-30kg → Delhivery (Priority 2)

**Result**:
- Rule 1 matches (prepaid, value ₹15000 ≥ ₹10000)
- BlueDart validated
- **Assigned**: BlueDart (Rule 1, Priority 1)

### Scenario 4: No Rules Match → Default Courier
**Zone**: "Zone B" (Remote)
**Order**: 5 kg, ₹3000, COD payment
**Rules**: None configured

**Result**:
- No rules found
- Fallback: Find default courier (lowest priority, services zone, supports COD)
- Default courier validated
- **Assigned**: Default Courier (ruleId: null, reason: "Default courier (no matching rules found)")

### Scenario 5: Manual Override
**Order**: Status = "confirmed" (not shipped yet)
**Action**: Admin manually assigns Shiprocket

**Result**:
- Old snapshot preserved in audit log
- New snapshot created with reason: "Manually assigned by admin"
- Order can proceed to processing

---

## 🛡️ Safety Features

### ✅ Deterministic Assignment
- Same inputs → Same courier
- No randomness or time-based changes
- Policy-driven selection

### ✅ Snapshot-Based
- Courier frozen at order creation
- Never automatically reassigned
- Manual override only before shipment

### ✅ COD Safety
- COD orders only assigned to COD-capable couriers
- Validation prevents COD assignment to non-COD couriers
- Clear error messages

### ✅ Fallback Protection
- Default courier if no rules match
- Checkout blocked only if no courier available
- Graceful degradation

### ✅ Lifecycle Integration
- **Processing**: Courier locked (cannot change)
- **Shipped**: Courier required (cannot ship without)
- **Audit Trail**: All assignments logged

### ✅ Store Isolation
- Each store has independent couriers/rules
- No cross-store data leakage
- Multi-tenant safe

---

## 📊 Order Snapshot Example

```json
{
  "orderId": "order_123",
  "courierSnapshot": {
    "courierId": "courier_abc",
    "courierName": "Delhivery",
    "courierCode": "DEL",
    "ruleId": "rule_xyz",
    "assignedAt": "2024-01-15T10:30:00Z",
    "reason": "Rule priority 1, weight 0-30 kg, courier priority 1"
  },
  "orderStatus": "confirmed"
}
```

---

## 🔄 Integration Points

### Order Creation Flow
```
1. Validate order items
2. Calculate pricing & discounts
3. Reserve inventory
4. Calculate shipping ← Shipping Engine
5. Calculate tax
6. Assign courier ← Courier Engine
7. Persist order with snapshot
8. Payment handoff
```

### Order Lifecycle Integration
```
- Processing: Courier locked (validation)
- Shipped: Courier required (validation)
- Manual Override: Allowed before shipment
```

### Future Carrier Integration
- **Shiprocket API**: Use `courierCode = "SR"` to identify Shiprocket orders
- **Delhivery API**: Use `courierCode = "DEL"` to identify Delhivery orders
- **AWB Generation**: Use `courierSnapshot.courierId` to fetch courier details
- **Tracking**: Use `courierCode` to route tracking requests

---

## 🎯 Best Practices

1. **Start Simple**: Create one courier per zone, then add rules
2. **Priority Strategy**: Use priority 1 for preferred courier, 2 for backup
3. **COD Handling**: Always configure COD-capable couriers for COD zones
4. **Weight Limits**: Set realistic maxWeight based on courier capabilities
5. **Fallback**: Configure default courier (lowest priority) for each zone
6. **Testing**: Use manual assignment to test before going live
7. **Monitoring**: Track courier assignment reasons in audit logs

---

## ❌ Common Mistakes (Avoided)

✅ **Not assigning at shipment time** - Assigned at order creation
✅ **Not ignoring COD capability** - Validated before assignment
✅ **Not having fallback courier** - Default courier configured
✅ **Not reassigning after shipment** - Locked after processing
✅ **Not having audit trail** - All assignments logged

---

## 🚀 Next Steps (Optional)

1. **Courier API Integration** - Shiprocket / Delhivery API
2. **Shipping Label & AWB Generation** - PDF labels from carrier
3. **Delivery ETA & SLA Engine** - Estimated delivery dates
4. **Courier Performance Analytics** - Reports and insights

---

## 📝 Summary

The Courier Mapping & Assignment Logic provides:
- ✅ **Deterministic** courier selection
- ✅ **Policy-driven** assignment (rules, not random)
- ✅ **COD-safe** logistics (validation)
- ✅ **Zone-aware** delivery
- ✅ **Snapshot-based** (frozen after assignment)
- ✅ **Admin override** control
- ✅ **Integration-ready** for Shiprocket / Delhivery
- ✅ **Multi-tenant** safe
- ✅ **Enterprise-grade** determinism

**This completes the shipping intelligence layer.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

