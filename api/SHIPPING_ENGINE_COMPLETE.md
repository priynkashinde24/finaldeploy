# Shipping Rate Table Engine - Complete Guide

## 🧠 Mental Model

```
Address → Zone → Rate Slab → Shipping Cost → Order Snapshot
```

**Shipping is configuration + math, not guesswork.**

---

## ✅ Architecture Overview

### 1. **Address → Zone Resolution**
- **Priority**: Pincode → State → Country
- Zones are store-specific
- One zone matches per address

### 2. **Zone → Rate Slab Selection**
- **Rate Types**: `weight` (kg) or `order_value` (₹)
- **Preference**: Weight-based if available, fallback to order value
- **Slab Matching**: Inclusive min, exclusive max
- **Non-overlapping**: One slab per zone per rate type

### 3. **Slab → Shipping Cost Calculation**
```
shipping = baseRate + (excessUnits × perUnitRate) + codSurcharge

Where:
- excessUnits = (value - minValue)
- codSurcharge = applied only if paymentMethod is 'cod' or 'cod_partial'
```

### 4. **Shipping Cost → Order Snapshot**
- **Immutable**: Calculated once at order creation
- **Never recalculated**: Frozen snapshot for invoice/audit
- **Complete breakdown**: zoneId, zoneName, rateType, slab, baseRate, variableRate, codSurcharge, totalShipping

---

## 📊 Data Models

### ShippingZone
```typescript
{
  storeId: ObjectId,
  name: string,              // e.g. "Local", "Zone A", "Zone B"
  countryCode: string,       // ISO code: "IN", "US", etc.
  stateCodes?: string[],     // Optional: ["MH", "GJ"]
  pincodes?: string[],       // Optional: ["400001", "400002"]
  isActive: boolean
}
```

### ShippingRate
```typescript
{
  storeId: ObjectId,
  zoneId: ObjectId,
  rateType: 'weight' | 'order_value',
  minValue: number,          // Inclusive minimum
  maxValue: number,          // Exclusive maximum
  baseRate: number,          // Base shipping charge
  perUnitRate: number,       // Per kg or per ₹
  codSurcharge: number,      // Additional COD charge
  isActive: boolean
}
```

### ShippingSnapshot (in Order)
```typescript
{
  zoneId: ObjectId,
  zoneName: string,
  rateType: 'weight' | 'order_value',
  slab: { min: number, max: number },
  baseRate: number,
  variableRate: number,
  codSurcharge: number,
  totalShipping: number,
  calculatedAt: Date
}
```

---

## 🔧 Configuration Guide

### Step 1: Create Shipping Zones

**API**: `POST /api/admin/shipping/zones`

```json
{
  "name": "Local",
  "countryCode": "IN",
  "stateCodes": ["MH"],
  "pincodes": ["400001", "400002", "400003"],
  "isActive": true
}
```

**Zone Resolution Priority:**
1. **Pincode match** (most specific)
2. **State match** (medium specificity)
3. **Country match** (fallback)

**Example Zones:**
- **Local**: Pincodes in Mumbai (400001-400099)
- **Zone A**: States MH, GJ
- **Zone B**: Country IN (all other states)
- **International**: Country US, UK, etc.

### Step 2: Create Rate Slabs

**API**: `POST /api/admin/shipping/rates`

#### Weight-Based Example
```json
{
  "zoneId": "zone_id_here",
  "rateType": "weight",
  "minValue": 0,
  "maxValue": 1,
  "baseRate": 50,
  "perUnitRate": 0,
  "codSurcharge": 20,
  "isActive": true
}
```
**Meaning**: 0-1 kg = ₹50 base + ₹20 COD (if COD)

```json
{
  "zoneId": "zone_id_here",
  "rateType": "weight",
  "minValue": 1,
  "maxValue": 5,
  "baseRate": 50,
  "perUnitRate": 30,
  "codSurcharge": 20,
  "isActive": true
}
```
**Meaning**: 1-5 kg = ₹50 base + ₹30 per kg excess + ₹20 COD

**Calculation for 3 kg order:**
- excessUnits = 3 - 1 = 2 kg
- variableRate = 2 × ₹30 = ₹60
- totalShipping = ₹50 + ₹60 + ₹20 (COD) = ₹130

#### Order Value-Based Example
```json
{
  "zoneId": "zone_id_here",
  "rateType": "order_value",
  "minValue": 0,
  "maxValue": 1000,
  "baseRate": 100,
  "perUnitRate": 0,
  "codSurcharge": 30,
  "isActive": true
}
```
**Meaning**: Orders ₹0-1000 = ₹100 base + ₹30 COD

```json
{
  "zoneId": "zone_id_here",
  "rateType": "order_value",
  "minValue": 1000,
  "maxValue": 5000,
  "baseRate": 100,
  "perUnitRate": 0.05,
  "codSurcharge": 30,
  "isActive": true
}
```
**Meaning**: Orders ₹1000-5000 = ₹100 base + 5% of excess + ₹30 COD

**Calculation for ₹3000 order:**
- excessUnits = 3000 - 1000 = ₹2000
- variableRate = 2000 × 0.05 = ₹100
- totalShipping = ₹100 + ₹100 + ₹30 (COD) = ₹230

### Step 3: Free Shipping Configuration

Set `baseRate = 0` and `perUnitRate = 0`:

```json
{
  "zoneId": "zone_id_here",
  "rateType": "order_value",
  "minValue": 5000,
  "maxValue": 999999,
  "baseRate": 0,
  "perUnitRate": 0,
  "codSurcharge": 0,
  "isActive": true
}
```
**Meaning**: Orders above ₹5000 = Free shipping

---

## 🚀 Usage in Order Creation

### Automatic Integration

Shipping is **automatically calculated** during order creation:

```typescript
// In orderCreation.service.ts
const shippingResult = await calculateShipping({
  storeId: storeObjId,
  shippingAddress: {
    country: "IN",
    state: "MH",
    zip: "400001"
  },
  orderWeight: 2.5,        // kg (calculated from items)
  orderValue: 2500,        // ₹ (subtotal after discounts)
  paymentMethod: "cod"     // or "stripe", "paypal"
});

// Snapshot stored in order
order.shippingSnapshot = shippingResult.snapshot;
order.shippingAmount = shippingResult.snapshot.totalShipping;
order.grandTotal = subtotal + tax + shippingAmount;
```

### Order Totals Formula

```
subtotal (after discounts)
+ shipping.totalShipping
+ tax.totalTax
= grandTotal
```

---

## ⚠️ Validation Rules

### 1. Non-Overlapping Slabs
- **Enforced**: Model-level validation prevents overlapping slabs
- **Error**: "Overlapping slab found: X-Y for this zone and rate type"

### 2. No Negative Rates
- **Enforced**: All rate fields must be ≥ 0
- **Fields**: baseRate, perUnitRate, codSurcharge

### 3. Store Isolation
- **Enforced**: Zones and rates are store-specific
- **Security**: Admin can only manage their store's shipping

### 4. Zone Resolution
- **Required**: Address must match at least one zone
- **Error**: "No shipping zone found for address: ..."
- **Blocking**: Checkout blocked if no zone found

### 5. Rate Slab Matching
- **Required**: Zone must have matching rate slab
- **Error**: "No shipping rate slab found for zone ..."
- **Blocking**: Checkout blocked if no rate found

---

## 📋 API Endpoints

### Zones

#### Create Zone
```http
POST /api/admin/shipping/zones
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Local",
  "countryCode": "IN",
  "stateCodes": ["MH"],
  "pincodes": ["400001"],
  "isActive": true
}
```

#### List Zones
```http
GET /api/admin/shipping/zones?countryCode=IN&isActive=true
Authorization: Bearer <admin_token>
```

#### Update Zone
```http
PATCH /api/admin/shipping/zones/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Rates

#### Create Rate
```http
POST /api/admin/shipping/rates
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "zoneId": "zone_id",
  "rateType": "weight",
  "minValue": 0,
  "maxValue": 5,
  "baseRate": 50,
  "perUnitRate": 30,
  "codSurcharge": 20,
  "isActive": true
}
```

#### List Rates
```http
GET /api/admin/shipping/rates?zoneId=zone_id&rateType=weight
Authorization: Bearer <admin_token>
```

#### Update Rate
```http
PATCH /api/admin/shipping/rates/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "baseRate": 60,
  "codSurcharge": 25
}
```

---

## 🔍 Example Scenarios

### Scenario 1: Local Delivery (Mumbai)
**Zone**: "Local" (pincodes 400001-400099)
**Rate**: Weight-based, 0-2 kg = ₹50, 2-5 kg = ₹50 + ₹30/kg
**Order**: 3 kg, COD payment
**Calculation**:
- Zone: "Local" (matched by pincode 400001)
- Slab: 2-5 kg
- excessUnits = 3 - 2 = 1 kg
- variableRate = 1 × ₹30 = ₹30
- totalShipping = ₹50 + ₹30 + ₹20 (COD) = ₹100

### Scenario 2: Free Shipping Above ₹5000
**Zone**: "Zone A" (all India)
**Rate**: Order value-based, ₹5000+ = Free
**Order**: ₹6000, Stripe payment
**Calculation**:
- Zone: "Zone A" (matched by country IN)
- Slab: ₹5000-999999
- baseRate = 0, perUnitRate = 0
- totalShipping = ₹0

### Scenario 3: International Shipping
**Zone**: "International" (country US)
**Rate**: Order value-based, ₹0-10000 = ₹500, ₹10000+ = ₹500 + 2%
**Order**: ₹15000, PayPal payment
**Calculation**:
- Zone: "International" (matched by country US)
- Slab: ₹10000-999999
- excessUnits = 15000 - 10000 = ₹5000
- variableRate = 5000 × 0.02 = ₹100
- totalShipping = ₹500 + ₹100 + ₹0 (no COD) = ₹600

---

## 🛡️ Safety Features

### ✅ Deterministic Calculation
- Same inputs → Same output
- No randomness or time-based changes

### ✅ Snapshot-Based
- Shipping cost frozen at order creation
- Never recalculated (even if rates change)
- Invoice-ready breakdown

### ✅ Audit Trail
- All zone/rate changes logged
- Shipping application to orders logged
- Full audit history available

### ✅ Store Isolation
- Each store has independent zones/rates
- No cross-store data leakage
- Multi-tenant safe

### ✅ Error Handling
- Clear error messages for missing zones/rates
- Checkout blocked if shipping cannot be calculated
- Validation prevents invalid configurations

---

## 📊 Order Snapshot Example

```json
{
  "orderId": "order_123",
  "shippingSnapshot": {
    "zoneId": "zone_abc",
    "zoneName": "Local",
    "rateType": "weight",
    "slab": {
      "min": 1,
      "max": 5
    },
    "baseRate": 50,
    "variableRate": 60,
    "codSurcharge": 20,
    "totalShipping": 130,
    "calculatedAt": "2024-01-15T10:30:00Z"
  },
  "shippingAmount": 130,
  "subtotal": 2500,
  "taxTotal": 450,
  "grandTotal": 3080
}
```

---

## 🎯 Best Practices

1. **Start Simple**: Create country-level zones first, then add state/pincode zones
2. **Test Coverage**: Ensure all delivery areas have zones and rates
3. **COD Surcharge**: Always configure COD surcharge for COD-enabled zones
4. **Free Shipping**: Use order value slabs for free shipping thresholds
5. **Weight vs Value**: Use weight for physical products, value for digital/services
6. **Slab Gaps**: Ensure no gaps in slabs (e.g., 0-5, 5-10, 10+)
7. **Documentation**: Keep zone names descriptive (e.g., "Mumbai Local", "Delhi NCR")

---

## 🔄 Integration Points

### Order Creation Flow
```
1. Validate order items
2. Calculate pricing & discounts
3. Reserve inventory
4. Calculate shipping ← Shipping Engine
5. Calculate tax
6. Persist order with snapshot
7. Payment handoff
```

### Invoice Generation
- Use `order.shippingSnapshot` for shipping line item
- Breakdown: Base + Variable + COD
- Never recalculate (use snapshot)

### Analytics
- Query orders by `shippingSnapshot.zoneName`
- Analyze shipping costs by zone
- Track COD surcharge revenue

---

## ❌ Common Mistakes (Avoided)

✅ **Not flat shipping everywhere** - Zone-based with slabs
✅ **Not recalculating after order** - Snapshot-based
✅ **Not ignoring COD surcharge** - Properly applied
✅ **Not overlapping slabs** - Validation enforced
✅ **Not missing snapshots** - Always stored

---

## 🚀 Next Steps (Optional)

1. **Carrier Integration** - Shiprocket / Delhivery API
2. **Shipping Label Generation** - PDF labels from carrier
3. **SLA & Delivery ETA Engine** - Estimated delivery dates
4. **Shipping Cost Analytics** - Reports and insights
5. **Multi-Carrier Support** - Multiple shipping providers

---

## 📝 Summary

The Shipping Rate Table Engine provides:
- ✅ **Deterministic** shipping calculation
- ✅ **Zone-based** pricing (pincode/state/country)
- ✅ **Weight & order value** slabs
- ✅ **COD surcharge** handling
- ✅ **Snapshot-based** (never recalculated)
- ✅ **Multi-tenant** safe
- ✅ **Enterprise-grade** determinism

**This completes the pricing → order → logistics chain.**

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*

