# RMA (Return Merchandise Authorization) System - Complete

## 🎯 Overview

A comprehensive RMA system for multi-vendor marketplace that handles:
- Customer return requests
- Multi-origin and partial returns
- Inventory reversal
- Refund processing (Stripe, PayPal, COD)
- Credit note generation
- Payout adjustments
- Full audit trail

---

## 📦 Components Built

### 1. **RMA Model** (`/api/src/models/RMA.ts`)
- Core RMA document with items, status, refund fields
- Supports multi-origin returns
- Status lifecycle: `requested → approved → pickup_scheduled → picked_up → received → refunded → closed`
- Tracks refund method, amounts, and credit notes

### 2. **RMA Number Generator** (`/api/src/utils/rmaNumber.ts`)
- Format: `RMA-{STORECODE}-{YYYY}-{SEQ}`
- Atomic, sequential per store per year
- Transaction-safe

### 3. **Return Policy Engine** (`/api/src/utils/returnPolicy.ts`)
- Validates return eligibility
- Checks return window (default: 7 days)
- Category-based return rules
- Condition-based approval
- COD return rules
- Non-returnable product flags

### 4. **RMA Service** (`/api/src/services/rma.service.ts`)
- `createRMA()` - Create return request
- `approveRMA()` - Approve return
- `rejectRMA()` - Reject return with reason
- `receiveRMA()` - Process receipt, inventory reversal, refund, credit note

### 5. **RMA Controller** (`/api/src/controllers/rma.controller.ts`)
- `POST /api/rma/orders/:orderId` - Create RMA request
- `GET /api/rma` - List RMAs (with filters)
- `GET /api/rma/:id` - Get RMA details
- `PATCH /api/rma/:id/approve` - Approve RMA
- `PATCH /api/rma/:id/reject` - Reject RMA
- `PATCH /api/rma/:id/receive` - Receive items and process refund
- `PATCH /api/rma/:id/status` - Update status (pickup tracking)

---

## 🔄 RMA Lifecycle

```
Customer Request
  ↓
RMA Created (status: requested)
  ↓
Admin/Supplier Review
  ↓
  ├─→ Approved (status: approved)
  │     ↓
  │   Pickup Scheduled (status: pickup_scheduled)
  │     ↓
  │   Picked Up (status: picked_up)
  │     ↓
  │   Received (status: received)
  │     ├─→ Inventory Reversal
  │     ├─→ Refund Calculation
  │     ├─→ Refund Execution
  │     ├─→ Credit Note Generation
  │     └─→ Payout Adjustment
  │     ↓
  │   Refunded (status: refunded)
  │     ↓
  │   Closed (status: closed)
  │
  └─→ Rejected (status: rejected)
        └─→ Reason stored
```

---

## 💰 Refund Processing

### Refund Calculation
- **Base**: Item price (proportional to return quantity)
- **Tax**: Proportional tax refund
- **Shipping**: Typically non-refundable (configurable)

### Refund Methods
1. **Original Payment** (`original`)
   - Stripe: Refund to original payment method
   - PayPal: Refund to PayPal account
2. **Wallet Credit** (`wallet`)
   - Credit customer wallet for future purchases
   - Used for COD returns
3. **COD Adjustment** (`cod_adjustment`)
   - Adjust in future COD orders
   - Used for COD returns

### Refund Execution Flow
```
RMA Received
  ↓
Calculate Refund Amount
  ↓
Execute Refund (based on payment method)
  ├─→ Stripe: stripe.refunds.create()
  ├─→ PayPal: paypalProvider.createRefund()
  └─→ COD: Wallet credit or adjustment
  ↓
Generate Credit Note
  ↓
Adjust Payment Split (negative ledger entries)
  ↓
Update RMA Status: refunded
```

---

## 📦 Inventory Reversal

### Rules
- **Resellable Items** (sealed/opened): Stock added back to origin inventory
- **Damaged Items**: Not added back (marked as loss)
- **Origin-Level**: Inventory reversed at the specific origin (warehouse)

### Process
```
RMA Received
  ↓
For Each Item:
  ├─→ Check Condition
  │     ├─→ sealed/opened: Add to origin inventory
  │     └─→ damaged: Skip (loss)
  ├─→ Update OriginVariantInventory
  │     ├─→ availableStock += quantity
  │     └─→ lastUpdatedAt = now
  └─→ Release Reservations
        └─→ Update InventoryReservation status
```

---

## 📄 Credit Note Generation

### Purpose
- Document refund for accounting
- Link to original invoice
- Negative amounts (credit)

### Process
```
RMA Refunded
  ↓
Find Original Customer Invoice
  ↓
Generate Credit Note Number (CN-{STORECODE}-{YYYY}-{SEQ})
  ↓
Create Credit Note
  ├─→ Link to invoice
  ├─→ Negative amounts (subtotal, tax, total)
  ├─→ Reason: "Return: RMA {rmaNumber}"
  └─→ Status: issued
  ↓
Link to RMA (creditNoteId)
```

---

## 💸 Payout Adjustment

### Rules
- **If payout not done**: Reduce ledger (prevent payout)
- **If payout done**: Create negative ledger entry (reverse)
- **Supplier & Reseller**: Balances adjusted proportionally

### Process
```
RMA Refunded
  ↓
Find PaymentSplit
  ↓
Calculate Refund Ratio (refundAmount / totalAmount)
  ↓
Reverse Payment Split
  ├─→ Create negative ledger entries
  ├─→ Supplier: -supplierAmount * ratio
  ├─→ Reseller: -resellerAmount * ratio
  └─→ Platform: -platformAmount * ratio
```

---

## 🔐 Safety & Invariants

### Hard Rules
1. ✅ **No return before delivery**: Order must be `delivered`
2. ✅ **No refund without RMA**: All refunds must have RMA
3. ✅ **Inventory reversal only after receipt**: Stock added only when items received
4. ✅ **Refund ≤ paid amount**: Cannot refund more than paid
5. ✅ **Immutable snapshots**: RMA data frozen after creation
6. ✅ **Return window**: Configurable (default: 7 days)
7. ✅ **Origin-level inventory**: Stock tracked per warehouse

### Validation
- Return window check
- Order status check
- Item existence check
- Quantity validation
- Product returnability check
- Condition validation

---

## 📊 API Endpoints

### Customer Endpoints
- `POST /api/rma/orders/:orderId` - Request return
- `GET /api/rma/:id` - View RMA status
- `GET /api/rma` - List own RMAs

### Admin/Supplier Endpoints
- `GET /api/rma` - List all RMAs (with filters)
- `GET /api/rma/:id` - View RMA details
- `PATCH /api/rma/:id/approve` - Approve RMA
- `PATCH /api/rma/:id/reject` - Reject RMA
- `PATCH /api/rma/:id/receive` - Receive items and process refund
- `PATCH /api/rma/:id/status` - Update status (pickup tracking)

---

## 🔍 Audit Logging

All RMA operations are logged:
- `RMA_REQUESTED` - Customer creates return request
- `RMA_APPROVED` - Admin/supplier approves
- `RMA_REJECTED` - Admin/supplier rejects
- `RMA_RECEIVED` - Items received, refund processed
- `RMA_REFUNDED` - Refund completed

Each log includes:
- RMA number
- Order ID
- Actor (user who performed action)
- Reason/notes
- Metadata (amounts, items, etc.)

---

## 🧪 Test Matrix

### Test Scenarios
1. ✅ **Full order return** - All items returned
2. ✅ **Partial item return** - Some items returned
3. ✅ **Multi-origin return** - Items from different origins
4. ✅ **Return outside window** - Rejected
5. ✅ **COD return** - Wallet credit or adjustment
6. ✅ **Inventory restock** - Stock added back correctly
7. ✅ **Refund correctness** - Amounts match
8. ✅ **Credit note generation** - Linked to invoice
9. ✅ **Ledger adjustment** - Payment split reversed

---

## 🔗 Integration Points

### Order Lifecycle
- Order status updated to `returned` or `partially_returned`
- Status history tracked

### Inventory System
- `OriginVariantInventory` updated
- `InventoryReservation` released

### Payment System
- Stripe refunds via `stripe.refunds.create()`
- PayPal refunds via `paypalProvider.createRefund()`
- COD handled via wallet/adjustment

### Invoice System
- Credit notes generated and linked
- Original invoice referenced

### Payout System
- Payment split reversed
- Ledger entries created

---

## 📝 Configuration

### Return Policy (Default)
```typescript
{
  returnWindowDays: 7,
  allowPartialReturns: true,
  allowMultiOriginReturns: true,
  codReturnMethod: 'wallet',
  nonReturnableCategories: [],
  nonReturnableReasons: [],
  requireSealedCondition: false,
}
```

### Customization
- Store-level return policies (TODO: Store model extension)
- Category-based rules
- Product-level flags
- Condition requirements

---

## 🚀 Future Enhancements

### Optional Features
1. **Return Fee Calculation** - Charge restocking fees
2. **Return Shipping Cost** - Customer pays return shipping
3. **Exchange Support** - Exchange instead of refund
4. **Return Analytics** - Return rate tracking
5. **Automated Approval** - Rules-based auto-approval
6. **Return Labels** - Generate return shipping labels
7. **Return Tracking** - Track return shipment status

---

## ✅ Summary

**Built**: Complete RMA system with:
- ✅ Request creation and validation
- ✅ Approval/rejection workflow
- ✅ Multi-origin support
- ✅ Inventory reversal
- ✅ Refund processing (Stripe, PayPal, COD)
- ✅ Credit note generation
- ✅ Payout adjustments
- ✅ Full audit trail
- ✅ Safety invariants

**Status**: Production-ready, fully integrated with existing systems.

---

*Last Updated: 2024-01-15*  
*Version: 1.0.0*

