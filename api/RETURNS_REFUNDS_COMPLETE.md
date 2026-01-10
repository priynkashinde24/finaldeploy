# Complete Returns & Refunds System - Client-Ready Explanation

## 🎯 Executive Summary

This document provides a comprehensive overview of the complete returns and refunds system in the marketplace backend, including RMA (Return Merchandise Authorization) processing, return shipping cost rules, refund calculations, credit note generation, and financial adjustments.

**Built for**: Multi-tenant marketplace with suppliers, resellers, and customers  
**Scale**: Production-ready, enterprise-grade  
**Philosophy**: Policy-driven, snapshot-based, immutable, financially accurate, auditable

---

## 🔄 Complete Return Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    RETURN LIFECYCLE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DELIVERED ORDER → RMA REQUEST → VALIDATION                │
│         ↓              ↓              ↓                      │
│    Customer      Policy Check    Eligibility                │
│                                                             │
│  APPROVAL → RETURN SHIPPING RULE → PICKUP                  │
│     ↓              ↓                    ↓                    │
│  Admin/Supplier  Cost + Payer      Scheduled                │
│                                                             │
│  RECEIPT → INVENTORY REVERSAL → REFUND → CREDIT NOTE       │
│     ↓              ↓              ↓          ↓              │
│  Items Back    Stock Restored   Processed   Generated      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Phase 1: RMA Request & Validation

### Step 1: Customer Request
- Customer requests return via API
- Provides items, quantities, reasons, conditions
- Specifies refund method (original/wallet/cod_adjustment)

### Step 2: Return Policy Validation
**System**: Return Policy Engine
- **Order Status Check**: Order must be `delivered`
- **Return Window**: Within configured days (default: 7 days)
- **Item Validation**: Items exist in order, quantities valid
- **Product Returnability**: Category-based rules, non-returnable flags
- **Condition Validation**: Sealed/opened/damaged rules

### Step 3: RMA Creation
- Generate RMA number: `RMA-{STORECODE}-{YYYY}-{SEQ}`
- Create RMA with items and metadata
- **Status**: `requested`
- Link to order and fulfillment snapshot

---

## 🔍 Phase 2: Return Shipping Rule Resolution

### Step 1: Rule Resolution (At Approval)
**System**: Return Shipping Rule Engine
- For each RMA item:
  - **SKU-Level Rule**: Highest priority (if exists)
  - **Category-Level Rule**: Fallback (if exists)
  - **Global Rule**: Final fallback
- Filter by:
  - Return reason (damaged, wrong_item, etc.)
  - Item condition (sealed, opened, damaged)
- **Result**: Matched rule with payer and charge type

### Step 2: Cost Calculation
**System**: Return Shipping Calculator
- **Flat**: Fixed amount from rule
- **Percentage**: % of original shipping cost
- **Actual Shipping**: Calculate reverse route (customer → origin)
- **Result**: Return shipping amount and payer

### Step 3: Snapshot Storage
- Store in RMA item:
  - Payer (customer/supplier/reseller/platform)
  - Amount
  - Rule snapshot (frozen at approval)
- **Immutable**: Never recalculated after approval

---

## ✅ Phase 3: Approval & Processing

### Step 1: Admin/Supplier Review
- Review RMA request
- **Decision**:
  - **Approve**: Status → `approved`
  - **Reject**: Status → `rejected` (with reason)

### Step 2: Pickup Scheduling
- Status → `pickup_scheduled`
- Courier assigned for reverse pickup
- **Future**: Integration with pickup API

### Step 3: Pickup Confirmation
- Status → `picked_up`
- Items in transit back to origin

---

## 📦 Phase 4: Receipt & Processing

### Step 1: Item Receipt
- Status → `received`
- Items inspected at origin

### Step 2: Inventory Reversal
**System**: RMA Service
- **Resellable Items** (sealed/opened):
  - Add stock back to `OriginVariantInventory`
  - Update `availableStock`
- **Damaged Items**:
  - Mark as loss (no restock)
- **Reservation Release**:
  - Update `InventoryReservation` status

### Step 3: Refund Calculation
**System**: RMA Service
- **Base Refund**: Item price (proportional to return quantity)
- **Tax Refund**: Proportional tax adjustment
- **Return Shipping Deduction**:
  - If payer = customer: Deduct from refund
  - If payer ≠ customer: No deduction (charged to payer)
- **Net Refund**: Base refund - shipping deduction (if customer pays)
- **Ensure**: Refund ≥ 0

### Step 4: Refund Execution
**System**: Payment Provider Integration
- **Stripe**: `stripe.refunds.create()`
- **PayPal**: `paypalProvider.createRefund()`
- **COD**: Wallet credit or future adjustment
- **Result**: Refund processed, status updated

### Step 5: Credit Note Generation
**System**: Invoice Generator Service
- Generate credit note number: `CN-{STORECODE}-{YYYY}-{SEQ}`
- Link to original customer invoice
- **Amounts** (negative):
  - Subtotal: Item refund
  - Tax: Proportional tax refund
  - Total: Net refund (after shipping deduction)
- **Metadata**: Return shipping deduction details

### Step 6: Ledger Adjustments
**System**: Payout Ledger Service
- **Item Refund**: Reverse payment split (negative entries)
- **Return Shipping Charges** (if not customer-paid):
  - Supplier: Negative ledger entry
  - Reseller: Negative ledger entry
  - Platform: Negative ledger entry
- **Result**: Balanced ledger, accurate payouts

---

## 💰 Financial Flow

### Return Shipping Cost Allocation

```
Return Shipping Rule
  ↓
Cost Calculation
  ↓
Payer Assignment
  ├─→ Customer: Deducted from refund
  ├─→ Supplier: Negative ledger entry
  ├─→ Reseller: Negative ledger entry
  └─→ Platform: Negative ledger entry
```

### Refund Calculation

```
Item Refund
  ├─→ Base: Item price × return ratio
  ├─→ Tax: Proportional tax refund
  └─→ Shipping: Deduction (if customer pays)
  ↓
Net Refund = Base + Tax - Shipping (if customer pays)
```

### Credit Note Structure

```
Credit Note
  ├─→ Subtotal: -Item Refund
  ├─→ Tax: -Tax Refund
  └─→ Total: -Net Refund (after shipping deduction)
```

---

## 🎯 Return Shipping Rules

### Rule Scopes

1. **SKU-Level** (Highest Priority)
   - Specific product variant
   - Most granular control
   - Example: "Premium headphones: Customer pays 50% of shipping"

2. **Category-Level** (Medium Priority)
   - Product category
   - Applies to all variants in category
   - Example: "Electronics: Supplier pays return shipping"

3. **Global** (Lowest Priority)
   - Store-wide default
   - Fallback when no specific rule matches
   - Example: "Default: Customer pays actual shipping cost"

### Charge Types

1. **Flat Amount**
   - Fixed return shipping cost
   - Example: ₹50 flat fee

2. **Percentage**
   - % of original shipping cost
   - Example: 50% of original shipping

3. **Actual Shipping**
   - Calculate reverse route cost
   - Customer address → Origin address
   - Uses shipping engine with reverse route

### Payer Options

1. **Customer**
   - Deducted from refund
   - No ledger entry
   - Shown in credit note

2. **Supplier**
   - Negative ledger entry
   - Charged to supplier payout
   - Supplier accountability

3. **Reseller**
   - Negative ledger entry
   - Charged to reseller commission
   - Reseller responsibility

4. **Platform**
   - Negative ledger entry
   - Platform absorbs cost
   - Customer-friendly policy

---

## 🔐 Safety & Invariants

### Financial Accuracy
- ✅ **No refund without RMA**: All refunds tracked
- ✅ **Refund ≤ paid amount**: Cannot refund more than paid
- ✅ **Return shipping snapshot**: Frozen at approval, never recalculated
- ✅ **Ledger balance**: All charges properly recorded
- ✅ **Credit note accuracy**: Reflects actual refund amount

### Inventory Accuracy
- ✅ **Origin-level tracking**: Stock at warehouse level
- ✅ **Condition-based restock**: Only resellable items restocked
- ✅ **Reservation release**: Properly released on return

### Policy Enforcement
- ✅ **Rule precedence**: SKU > Category > Global strictly enforced
- ✅ **Reason/condition matching**: Rules filtered by return context
- ✅ **One rule per item**: Highest priority match wins
- ✅ **Immutable snapshots**: Rules frozen at approval

### Audit Trail
- ✅ **All operations logged**: Request, approval, receipt, refund
- ✅ **Rule applications tracked**: Which rule applied, why
- ✅ **Financial records**: Credit notes, ledger entries
- ✅ **Status history**: Complete timeline

---

## 📊 Key Mental Models

### 1. Returns are Financial Events
**Key Insight**: Returns trigger financial transactions, not just UI actions

**Process**:
- RMA created → Financial record
- Return shipping rule applied → Cost allocated
- Items received → Inventory reversal
- Refund processed → Payment reversal
- Credit note issued → Accounting record
- Ledger adjusted → Payout corrections

**Benefits**:
- Financial accuracy
- Audit compliance
- Supplier accountability
- Legal compliance

### 2. Return Shipping is Policy, Not Hardcoded
**Key Insight**: Shipping costs determined by rules, not fixed fees

**Flow**:
- SKU + Reason + Condition → Rule Resolution
- Rule → Cost Calculation + Payer Assignment
- Snapshot → Frozen at Approval
- Refund/Ledger → Financial Adjustment

**Benefits**:
- Flexible policies
- Fair customer treatment
- Supplier accountability
- Margin protection

### 3. Snapshot-Based Calculations
**Key Insight**: All calculations frozen at approval, never recalculated

**Snapshots**:
- Return shipping rule (payer, amount, rule details)
- Refund amount (base, tax, shipping deduction)
- Credit note (all amounts)

**Benefits**:
- Deterministic refunds
- Audit trail
- No price changes after approval
- Invoice-ready data

### 4. Multi-Payer Support
**Key Insight**: Return shipping can be paid by different parties

**Options**:
- Customer: Deducted from refund
- Supplier: Charged to supplier ledger
- Reseller: Charged to reseller ledger
- Platform: Platform absorbs cost

**Benefits**:
- Flexible policies
- Fair cost allocation
- Supplier accountability
- Customer-friendly options

---

## 🔗 System Integration

### RMA → Return Shipping Rules
- Rules resolved at approval
- Cost calculated and snapshotted
- Payer assigned

### Return Shipping → Refund
- Customer-paid: Deducted from refund
- Non-customer: Charged to ledger

### Return Shipping → Credit Note
- Shipping deduction shown in credit note
- Net refund amount calculated
- Metadata includes shipping details

### Return Shipping → Ledger
- Negative entries for non-customer payers
- Supplier/reseller/platform balances adjusted
- Proper cost allocation

---

## 📋 API Summary

### RMA APIs
- `POST /api/rma/orders/:orderId` - Request return
- `GET /api/rma/:id` - Get RMA
- `PATCH /api/rma/:id/approve` - Approve RMA
- `PATCH /api/rma/:id/reject` - Reject RMA
- `PATCH /api/rma/:id/receive` - Receive items

### Return Shipping Rule APIs (Admin)
- `POST /api/admin/return-shipping-rules` - Create rule
- `GET /api/admin/return-shipping-rules` - List rules
- `GET /api/admin/return-shipping-rules/:id` - Get rule
- `PATCH /api/admin/return-shipping-rules/:id` - Update rule
- `DELETE /api/admin/return-shipping-rules/:id` - Delete rule

---

## 🚀 Production Readiness

### ✅ Completed Systems
1. ✅ RMA Request & Validation
2. ✅ Return Policy Engine
3. ✅ Return Shipping Rule Engine
4. ✅ Return Shipping Calculator
5. ✅ RMA Approval Workflow
6. ✅ Inventory Reversal
7. ✅ Refund Calculation & Execution
8. ✅ Credit Note Generation
9. ✅ Ledger Adjustments
10. ✅ Admin Rule Management

### ✅ Safety Features
- ✅ Policy-driven validation
- ✅ Snapshot-based calculations
- ✅ Financial accuracy
- ✅ Inventory correctness
- ✅ Audit trails
- ✅ Rule precedence enforcement

### ✅ Scalability Features
- ✅ Multi-origin returns
- ✅ Partial returns
- ✅ Flexible rule system
- ✅ Multi-payer support
- ✅ Event-driven updates

---

## 📈 Business Value

### For Customers
- ✅ **Fair refunds**: Return shipping properly handled
- ✅ **Transparency**: Clear cost breakdown
- ✅ **Flexibility**: Multiple refund methods
- ✅ **Policy clarity**: Rules visible and consistent

### For Suppliers
- ✅ **Accountability**: Proper cost allocation
- ✅ **Inventory accuracy**: Origin-level tracking
- ✅ **Financial clarity**: Correct ledger entries
- ✅ **Policy control**: SKU-level rules

### For Resellers
- ✅ **Commission protection**: Proper adjustments
- ✅ **Customer satisfaction**: Easy returns
- ✅ **Financial accuracy**: Correct ledger entries
- ✅ **Policy flexibility**: Reseller-paid options

### For Platform
- ✅ **Margin protection**: Prevent leakage
- ✅ **Financial accuracy**: All costs tracked
- ✅ **Audit compliance**: Complete trail
- ✅ **Policy flexibility**: Multi-payer support

---

## 🎓 Summary

This returns and refunds system provides:

✅ **Complete RMA Lifecycle**: Request → Approval → Receipt → Refund  
✅ **Policy-Driven Shipping**: SKU/category/global rules  
✅ **Financial Accuracy**: Proper refunds, deductions, ledger entries  
✅ **Inventory Correctness**: Origin-level reversal, condition-based restock  
✅ **Audit Compliance**: Full trail, immutable snapshots  
✅ **Multi-Payer Support**: Customer/supplier/reseller/platform options  

**Key Innovations**:
- Return shipping as policy (not hardcoded)
- Snapshot-based calculations
- Multi-payer cost allocation
- SKU-level rule control
- Complete financial integration

**This is a full-scale, enterprise-grade returns and refunds system with policy-driven return shipping, ready for production deployment.**

---

*Last Updated: 2024-01-15*  
*Version: 1.0.0*  
*Architecture: Policy-driven, Snapshot-based, Financially Accurate, Auditable*

