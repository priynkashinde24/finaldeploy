# Courier Mapping System - Complete Guide

## 🎯 Overview

The Courier Mapping System provides intelligent courier assignment for three distinct scenarios:
- **Logistics**: Outbound shipping for customer orders
- **Returns**: Reverse logistics for return pickups and deliveries
- **CRM**: Customer service scenarios (replacements, warranty, document delivery, etc.)

This system extends the existing courier engine with scenario-specific rules, priority-based selection, and flexible configuration options.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Usage Examples](#usage-examples)
6. [Configuration](#configuration)
7. [Best Practices](#best-practices)

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    COURIER MAPPING FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  REQUEST → SCENARIO TYPE → FILTER MAPPINGS                  │
│     ↓              ↓              ↓                          │
│  Logistics    Returns      CRM                             │
│     ↓              ↓              ↓                          │
│  Apply Filters → Validate → Score → Select                 │
│     ↓              ↓              ↓                          │
│  Weight/Value  Return Reason  Urgency/Tier                  │
│     ↓              ↓              ↓                          │
│  Payment Method  Pickup Support  Scenario Type              │
│     ↓              ↓              ↓                          │
│  CONDITIONS CHECK → COURIER VALIDATION                      │
│     ↓                                                         │
│  SCORE CALCULATION → SELECT BEST MATCH                      │
│     ↓                                                         │
│  RETURN COURIER + FALLBACK                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **CourierMapping Model**: Stores mapping rules for different scenarios
2. **CourierMapping Service**: Core logic for courier selection
3. **CourierMapping Controller**: API endpoints for mapping and rule management
4. **Integration**: Works with existing Courier and CourierRule models

---

## ✨ Features

### 1. **Multi-Scenario Support**

- **Logistics**: Outbound shipping with zone, weight, value, payment method filters
- **Returns**: Reverse logistics with return reason, condition, pickup support
- **CRM**: Customer service with scenario type, urgency, customer tier

### 2. **Flexible Filtering**

- **Weight/Value Ranges**: Min/max filters for order weight and value
- **Payment Methods**: Filter by prepaid, COD, or both
- **Return Reasons**: Filter by specific return reasons (defective, wrong_item, etc.)
- **Item Conditions**: Filter by sealed, opened, damaged
- **CRM Scenarios**: Support tickets, document delivery, replacements, warranty

### 3. **Priority-Based Selection**

- **Cost Priority**: Select courier based on lowest cost
- **Speed Priority**: Select courier based on fastest delivery
- **Reliability Priority**: Select courier based on reliability
- **Coverage Priority**: Select courier based on zone coverage
- **Custom Priority**: Use custom scoring

### 4. **Conditional Rules**

- **Time of Day**: Apply rules during specific hours
- **Day of Week**: Apply rules on specific days
- **Season/Events**: Apply rules during special events
- **Special Events**: Enable/disable for special occasions

### 5. **Fallback Support**

- Primary courier assignment
- Fallback courier for backup
- Default courier engine integration

### 6. **Scoring System**

- Base score calculation
- Priority-based adjustments
- Urgency multipliers (for CRM)
- Custom scoring support

---

## 📊 Data Models

### CourierMapping

```typescript
{
  storeId: ObjectId,
  mappingType: 'logistics' | 'returns' | 'crm',
  name: string,
  description?: string,
  
  // Courier assignment
  courierId: ObjectId,
  fallbackCourierId?: ObjectId,
  
  // Logistics filters
  shippingZoneId?: ObjectId,
  paymentMethod?: 'prepaid' | 'cod' | 'both',
  minWeight?: number,
  maxWeight?: number,
  minOrderValue?: number,
  maxOrderValue?: number,
  
  // Returns filters
  returnReason?: string[],
  itemCondition?: 'sealed' | 'opened' | 'damaged' | 'all',
  returnValue?: number,
  supportsPickup?: boolean,
  
  // CRM filters
  crmScenario?: 'support_ticket' | 'document_delivery' | 'replacement' | 'warranty' | 'all',
  urgency?: 'low' | 'medium' | 'high' | 'critical',
  customerTier?: 'standard' | 'premium' | 'vip' | 'all',
  
  // Priority
  priority: number, // Lower = higher priority
  selectionPriority: 'cost' | 'speed' | 'reliability' | 'coverage' | 'custom',
  customScore?: number,
  
  // Conditions
  conditions?: {
    timeOfDay?: string[], // e.g., ['09:00-17:00']
    dayOfWeek?: string[], // e.g., ['monday', 'tuesday']
    season?: string[],
    specialEvent?: boolean,
  },
  
  isActive: boolean,
  metadata?: Record<string, any>
}
```

---

## 🔌 API Endpoints

### Map Courier for Logistics

**POST** `/api/courier-mapping/logistics`

Map courier for outbound shipping.

**Request Body:**
```json
{
  "shippingZoneId": "zone_id",
  "orderWeight": 2.5,
  "orderValue": 1500,
  "paymentMethod": "cod",
  "shippingPincode": "110001",
  "priority": "cost"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courier": {
      "id": "courier_id",
      "name": "Delhivery",
      "code": "DEL",
      "supportsCOD": true
    },
    "mappingId": "mapping_id",
    "reason": "Logistics mapping: Standard COD (priority: cost)",
    "score": 950,
    "fallbackCourier": {
      "id": "fallback_id",
      "name": "Shiprocket",
      "code": "SR"
    }
  }
}
```

### Map Courier for Returns

**POST** `/api/courier-mapping/returns`

Map courier for reverse logistics.

**Request Body:**
```json
{
  "rmaId": "rma_id",
  "returnReason": "defective",
  "itemCondition": "sealed",
  "returnValue": 1500,
  "originZoneId": "origin_zone_id",
  "customerZoneId": "customer_zone_id",
  "requiresPickup": true,
  "priority": "cost"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courier": {
      "id": "courier_id",
      "name": "Delhivery",
      "code": "DEL",
      "supportsCOD": true
    },
    "mappingId": "mapping_id",
    "reason": "Returns mapping: Defective Returns (priority: cost)",
    "score": 920
  }
}
```

### Map Courier for CRM

**POST** `/api/courier-mapping/crm`

Map courier for customer service scenarios.

**Request Body:**
```json
{
  "scenario": "replacement",
  "urgency": "high",
  "customerTier": "premium",
  "destinationZoneId": "zone_id",
  "weight": 1.5,
  "value": 2000,
  "priority": "speed"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courier": {
      "id": "courier_id",
      "name": "BlueDart",
      "code": "BD",
      "supportsCOD": false
    },
    "mappingId": "mapping_id",
    "reason": "CRM mapping: Premium Replacement (scenario: replacement, urgency: high)",
    "score": 1850
  }
}
```

### Create Mapping Rule

**POST** `/api/admin/courier-mapping/rules`

Create a new courier mapping rule.

**Request Body:**
```json
{
  "mappingType": "logistics",
  "name": "High Value COD Orders",
  "description": "Use premium courier for high value COD orders",
  "courierId": "courier_id",
  "fallbackCourierId": "fallback_id",
  "shippingZoneId": "zone_id",
  "paymentMethod": "cod",
  "minOrderValue": 5000,
  "priority": 10,
  "selectionPriority": "reliability",
  "isActive": true
}
```

### List Mapping Rules

**GET** `/api/admin/courier-mapping/rules?mappingType=logistics&isActive=true&page=1&limit=50`

List all courier mapping rules with pagination.

### Get Available Couriers

**GET** `/api/courier-mapping/available?mappingType=logistics&zoneId=zone_id&paymentMethod=cod&weight=2.5`

Get available couriers for a scenario.

---

## 💡 Usage Examples

### Example 1: Logistics - High Value COD Orders

```typescript
// Create mapping rule for high value COD orders
const mapping = await CourierMapping.create({
  storeId: storeId,
  mappingType: 'logistics',
  name: 'High Value COD',
  courierId: premiumCourierId,
  shippingZoneId: zoneId,
  paymentMethod: 'cod',
  minOrderValue: 5000,
  priority: 5,
  selectionPriority: 'reliability',
  isActive: true,
});

// Use mapping
const result = await mapCourierForLogistics({
  storeId,
  shippingZoneId: zoneId,
  orderWeight: 3.0,
  orderValue: 7500,
  paymentMethod: 'cod',
  priority: 'reliability',
});
```

### Example 2: Returns - Defective Items

```typescript
// Create mapping rule for defective returns
const mapping = await CourierMapping.create({
  storeId: storeId,
  mappingType: 'returns',
  name: 'Defective Returns',
  courierId: reliableCourierId,
  returnReason: ['defective'],
  itemCondition: 'all',
  supportsPickup: true,
  priority: 10,
  selectionPriority: 'speed',
  isActive: true,
});

// Use mapping
const result = await mapCourierForReturns({
  storeId,
  returnReason: 'defective',
  itemCondition: 'damaged',
  originZoneId: originZoneId,
  customerZoneId: customerZoneId,
  requiresPickup: true,
  priority: 'speed',
});
```

### Example 3: CRM - Premium Customer Replacements

```typescript
// Create mapping rule for premium customer replacements
const mapping = await CourierMapping.create({
  storeId: storeId,
  mappingType: 'crm',
  name: 'Premium Replacements',
  courierId: expressCourierId,
  crmScenario: 'replacement',
  customerTier: 'premium',
  urgency: 'high',
  priority: 5,
  selectionPriority: 'speed',
  isActive: true,
});

// Use mapping
const result = await mapCourierForCRM({
  storeId,
  scenario: 'replacement',
  urgency: 'high',
  customerTier: 'premium',
  destinationZoneId: zoneId,
  weight: 2.0,
  priority: 'speed',
});
```

### Example 4: Conditional Rules - Business Hours Only

```typescript
// Create mapping rule that only applies during business hours
const mapping = await CourierMapping.create({
  storeId: storeId,
  mappingType: 'logistics',
  name: 'Business Hours Express',
  courierId: expressCourierId,
  priority: 10,
  conditions: {
    timeOfDay: ['09:00-17:00'],
    dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },
  isActive: true,
});
```

---

## ⚙️ Configuration

### Priority Levels

- **Lower priority number = Higher priority**
- Example: Priority 1 is higher than priority 10
- Use priority to control rule matching order

### Selection Priorities

1. **cost**: Select courier with lowest cost
2. **speed**: Select courier with fastest delivery
3. **reliability**: Select courier with best reliability
4. **coverage**: Select courier with best zone coverage
5. **custom**: Use custom scoring

### Scoring System

The scoring system calculates a score for each matching courier:

- **Base Score**: 1000
- **Courier Priority**: Subtracts `courier.priority * 10`
- **Mapping Priority**: Subtracts `mapping.priority * 5`
- **Selection Priority**: Adjusts based on priority type
- **Urgency Multiplier** (CRM only):
  - Critical: 3.0x
  - High: 2.0x
  - Medium: 1.5x
  - Low: 1.0x

### Conditions

- **timeOfDay**: Array of time ranges (e.g., `['09:00-17:00', '18:00-22:00']`)
- **dayOfWeek**: Array of day names (e.g., `['monday', 'tuesday']`)
- **season**: Array of season names (e.g., `['festival', 'normal']`)
- **specialEvent**: Boolean flag for special events

---

## 🎯 Best Practices

### 1. **Rule Organization**

- Use descriptive names for mapping rules
- Group rules by scenario type
- Set appropriate priority levels
- Use fallback couriers for critical scenarios

### 2. **Filtering Strategy**

- Start with broad filters, then narrow down
- Use zone-based filters for logistics
- Use return reason filters for returns
- Use urgency and tier filters for CRM

### 3. **Priority Management**

- Reserve priority 1-10 for critical rules
- Use priority 11-50 for standard rules
- Use priority 51-100 for fallback rules
- Test priority changes in staging

### 4. **Conditional Rules**

- Use time-based conditions for business hours
- Use day-based conditions for weekday/weekend
- Use event flags for special occasions
- Test conditions thoroughly

### 5. **Fallback Strategy**

- Always set a fallback courier for critical scenarios
- Test fallback courier availability
- Monitor fallback usage
- Update fallback rules as needed

### 6. **Performance**

- Index frequently queried fields
- Use pagination for rule listing
- Cache mapping results when appropriate
- Monitor query performance

### 7. **Testing**

- Test all mapping scenarios
- Test edge cases (weight limits, value ranges)
- Test conditional rules
- Test fallback scenarios

---

## 🔄 Integration Points

### With Existing Courier Engine

The courier mapping system integrates with the existing courier engine:

- Falls back to default courier engine if no mappings match
- Uses existing Courier and CourierRule models
- Validates couriers using existing validation logic

### With RMA System

- Automatically maps couriers for return pickups
- Uses RMA data for return mapping
- Integrates with return shipping rules

### With Order System

- Maps couriers during order creation
- Stores mapping results in order snapshots
- Supports manual courier reassignment

---

## 📝 Notes

- Mapping rules are evaluated in priority order
- First matching rule wins (highest priority)
- Conditions must all pass for a rule to match
- Courier must be active and valid for the scenario
- Fallback courier is used if primary courier fails

---

## 🚀 Future Enhancements

1. **Machine Learning**: Learn from historical courier performance
2. **Real-time Tracking**: Integrate with courier tracking APIs
3. **Cost Optimization**: Optimize courier selection based on cost
4. **Performance Analytics**: Track courier performance metrics
5. **A/B Testing**: Test different courier strategies
6. **Multi-courier Support**: Support multiple couriers per order
7. **Dynamic Pricing**: Adjust courier selection based on pricing

---

## 📚 Related Documentation

- [Courier Engine](./COURIER_MAPPING_COMPLETE.md)
- [RMA System](./RETURNS_REFUNDS_COMPLETE.md)
- [Order Lifecycle](./COMPLETE_ORDER_LIFECYCLE.md)

