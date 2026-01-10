# Centralized Audit Logs System

## ✅ Implementation Complete!

### STEP 1: Audit Log Model ✅

**File**: `api/src/models/AuditLog.ts`

**Fields:**
- ✅ `storeId` - Store (tenant) reference (null for system-wide actions)
- ✅ `actorId` - User ID (null for system actions)
- ✅ `actorRole` - "admin" | "supplier" | "reseller" | "system"
- ✅ `action` - Action name (e.g., "LOGIN_SUCCESS", "PRICE_RULE_UPDATED")
- ✅ `entityType` - Entity type (e.g., "Order", "Product", "PricingRule")
- ✅ `entityId` - Entity ID (null if not applicable)
- ✅ `before` - Snapshot before change
- ✅ `after` - Snapshot after change
- ✅ `ipAddress` - IP address
- ✅ `userAgent` - User agent
- ✅ `metadata` - Additional metadata
- ✅ `createdAt` - Timestamp

**Rules:**
- ✅ Logs are append-only (never update or delete)
- ✅ `storeId` is mandatory for multi-tenant isolation
- ✅ Indexed for efficient queries

---

### STEP 2: Audit Logger Utility ✅

**File**: `api/src/utils/auditLogger.ts`

**Function**: `logAudit(params)`

**Auto-extracts:**
- ✅ `storeId` from `req.store` (if available)
- ✅ `actorId` from `req.user` (if available)
- ✅ `actorRole` from `req.user` (if available)
- ✅ IP address and user agent from `req`

**Usage:**
```typescript
import { logAudit } from '../utils/auditLogger';

await logAudit({
  req, // Request object (auto-extracts storeId, actorId, IP, userAgent)
  action: 'PRICE_RULE_UPDATED',
  entityType: 'PricingRule',
  entityId: pricingRule._id.toString(),
  before: oldPricingRule, // Snapshot before change
  after: newPricingRule, // Snapshot after change
  description: 'Pricing rule updated',
  metadata: {
    changedFields: ['minMarginValue', 'maxDiscountPercentage'],
  },
});
```

---

### STEP 3: Global Audit Middleware ✅

**File**: `api/src/middleware/auditMiddleware.ts`

**Usage Examples:**

#### Basic Usage
```typescript
import { auditMiddleware } from '../middleware/auditMiddleware';

router.post(
  '/pricing-rules',
  authenticate,
  resolveStore,
  auditMiddleware({
    action: 'PRICING_RULE_CREATED',
    entityType: 'PricingRule',
    getEntityId: (req, res) => res.locals.createdId || req.body.id,
    getAfter: (req) => req.body,
  }),
  createPricingRule
);
```

#### Pre-configured Middlewares
```typescript
import { auditMiddlewares } from '../middleware/auditMiddleware';

// For create operations
router.post('/products', 
  authenticate,
  resolveStore,
  auditMiddlewares.onCreate('Product'),
  createProduct
);

// For update operations
router.patch('/products/:id',
  authenticate,
  resolveStore,
  auditMiddlewares.onUpdate('Product'),
  updateProduct
);

// For delete operations
router.delete('/products/:id',
  authenticate,
  resolveStore,
  auditMiddlewares.onDelete('Product'),
  deleteProduct
);

// For login
router.post('/auth/login',
  auditMiddlewares.onLogin(),
  login
);

// For logout
router.post('/auth/logout',
  authenticate,
  auditMiddlewares.onLogout(),
  logout
);
```

#### Advanced Usage with Before/After Snapshots
```typescript
router.patch('/pricing-rules/:id',
  authenticate,
  resolveStore,
  auditMiddleware({
    action: 'PRICING_RULE_UPDATED',
    entityType: 'PricingRule',
    getEntityId: (req) => req.params.id,
    getBefore: async (req) => {
      // Fetch existing entity before update
      const { PricingRule } = await import('../models/PricingRule');
      const existing = await PricingRule.findById(req.params.id).lean();
      return existing;
    },
    getAfter: (req) => req.body,
    description: (req) => `Pricing rule ${req.params.id} updated`,
    metadata: (req) => ({
      updatedFields: Object.keys(req.body),
    }),
  }),
  updatePricingRule
);
```

---

## 📋 Features

### ✅ Multi-Tenant Safe
- All logs include `storeId` for tenant isolation
- Queries automatically filter by store (if `req.store` exists)
- Admins can query across all stores

### ✅ Immutable & Queryable
- Logs are append-only (never updated or deleted)
- Comprehensive indexes for fast queries
- Support for filtering by:
  - Store
  - Actor (user)
  - Action
  - Entity type
  - Entity ID
  - Date range

### ✅ Before/After Snapshots
- Capture state before and after changes
- Useful for debugging and compliance
- Supports full entity snapshots

### ✅ System Actions
- Support for "system" role (automated jobs, background tasks)
- `actorId` can be null for system actions
- `storeId` can be null for system-wide actions

---

## 🔍 Querying Audit Logs

### Admin API

**GET `/api/admin/audit-logs`**

**Query Parameters:**
- `storeId` - Filter by store (optional, auto-filtered if `req.store` exists)
- `actorId` - Filter by actor (user ID)
- `actorUserId` - Legacy: Filter by actor (backward compatibility)
- `action` - Filter by action (e.g., "LOGIN_SUCCESS")
- `entityType` - Filter by entity type (e.g., "Order")
- `entityId` - Filter by entity ID
- `dateFrom` - Start date (ISO format)
- `dateTo` - End date (ISO format)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Example:**
```bash
GET /api/admin/audit-logs?storeId=123&action=PRICE_RULE_UPDATED&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log123",
        "store": {
          "id": "store123",
          "name": "My Store",
          "slug": "my-store"
        },
        "actor": {
          "id": "user456",
          "name": "John Doe",
          "email": "john@example.com",
          "role": "admin"
        },
        "actorRole": "admin",
        "action": "PRICE_RULE_UPDATED",
        "entityType": "PricingRule",
        "entityId": "rule789",
        "before": {
          "minMarginValue": 10,
          "maxDiscountPercentage": 20
        },
        "after": {
          "minMarginValue": 15,
          "maxDiscountPercentage": 25
        },
        "description": "Pricing rule updated",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "metadata": {
          "changedFields": ["minMarginValue", "maxDiscountPercentage"]
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

## 🎯 Common Actions

### Authentication
- `LOGIN_SUCCESS` - User logged in
- `LOGIN_FAILED` - Login attempt failed
- `LOGOUT` - User logged out
- `ACCOUNT_LOCKED` - Account locked due to failed attempts

### Store Management
- `STORE_CREATED` - Store created
- `STORE_UPDATED` - Store updated
- `STORE_SUSPENDED` - Store suspended
- `STORE_ACTIVATED` - Store activated

### Pricing
- `PRICING_RULE_CREATED` - Pricing rule created
- `PRICING_RULE_UPDATED` - Pricing rule updated
- `PRICING_RULE_DELETED` - Pricing rule deleted
- `MARKUP_RULE_CREATED` - Markup rule created
- `MARKUP_RULE_UPDATED` - Markup rule updated

### Orders
- `ORDER_CREATED` - Order created
- `ORDER_UPDATED` - Order updated
- `ORDER_CANCELLED` - Order cancelled

### Products
- `PRODUCT_CREATED` - Product created
- `PRODUCT_UPDATED` - Product updated
- `PRODUCT_DELETED` - Product deleted

### User Management
- `USER_CREATED` - User created
- `USER_UPDATED` - User updated
- `USER_APPROVED` - User approved
- `USER_REJECTED` - User rejected
- `USER_BLOCKED` - User blocked

### KYC
- `KYC_SUBMITTED` - KYC submitted
- `KYC_APPROVED` - KYC approved
- `KYC_REJECTED` - KYC rejected

---

## 🔒 Security & Compliance

### ✅ Data Isolation
- All logs are scoped to store (multi-tenant safe)
- Admins can query across stores
- Regular users can only see their store's logs

### ✅ Immutability
- Logs are never updated or deleted
- Append-only design ensures audit trail integrity
- Perfect for compliance requirements

### ✅ Complete Audit Trail
- Who did what (actor)
- When (timestamp)
- Where (IP address, user agent)
- What changed (before/after snapshots)
- Context (metadata)

---

## 📝 Migration Notes

### Backward Compatibility
- Legacy `actorUserId` field still supported
- Existing audit logs continue to work
- New logs use `actorId` (preferred)

### Existing Logs
- Old logs without `storeId` will have `storeId: null`
- These represent system-wide or pre-multi-tenant actions
- Can be backfilled if needed

---

## 🚀 Next Steps

1. **Apply Middleware to Routes**
   - Add audit middleware to sensitive routes
   - Use pre-configured middlewares where possible

2. **Update Existing Logs**
   - Review existing `logAudit` calls
   - Add `before`/`after` snapshots where useful
   - Ensure `storeId` is captured

3. **Frontend Integration**
   - Build admin audit log viewer
   - Add filtering and search
   - Export functionality for compliance

---

## ✅ Summary

**Complete Audit Logs System:**
- ✅ Multi-tenant safe (storeId isolation)
- ✅ Immutable (append-only)
- ✅ Queryable (comprehensive indexes)
- ✅ Before/after snapshots
- ✅ System actions support
- ✅ Global middleware
- ✅ Pre-configured middlewares
- ✅ Backward compatible

**Ready for production!** 🎉

