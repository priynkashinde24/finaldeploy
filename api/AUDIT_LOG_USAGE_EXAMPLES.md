# Audit Log System - Usage Examples

## ✅ Implementation Complete!

All audit log calls in `auth.controller.ts` have been updated to use the new API.

---

## 📋 Updated API

### New `logAudit` Function Signature

```typescript
await logAudit({
  req,                    // Request object (auto-extracts storeId, actorId, IP, userAgent)
  storeId?: string,       // Optional: Override storeId (auto-extracted from req.store)
  actorId?: string,       // Optional: Override actorId (auto-extracted from req.user)
  actorRole?: string,      // Optional: Override actorRole (auto-extracted from req.user)
  action: string,         // Required: Action name
  entityType: string,     // Required: Entity type
  entityId?: string,      // Optional: Entity ID
  before?: object,        // Optional: Snapshot before change
  after?: object,         // Optional: Snapshot after change
  description: string,    // Required: Human-readable description
  metadata?: object,      // Optional: Additional metadata
});
```

---

## 🔄 Migration from Old API

### Before (Old API)
```typescript
await logAudit({
  actorUserId: user._id.toString(),
  actorRole: user.role,
  action: 'LOGIN_SUCCESS',
  entityType: 'User',
  entityId: user._id.toString(),
  description: 'User logged in',
  req,
  metadata: { email: user.email },
});
```

### After (New API)
```typescript
await logAudit({
  req, // Auto-extracts actorId, actorRole, storeId, IP, userAgent
  action: 'LOGIN_SUCCESS',
  entityType: 'User',
  entityId: user._id.toString(),
  description: 'User logged in',
  metadata: { email: user.email },
});
```

**Benefits:**
- ✅ Less boilerplate (auto-extracts from `req`)
- ✅ Multi-tenant safe (auto-extracts `storeId` from `req.store`)
- ✅ Consistent IP/userAgent extraction
- ✅ Backward compatible (still supports `actorUserId`)

---

## 📝 Examples by Use Case

### 1. Login Success (with storeId)
```typescript
await logAudit({
  req, // Auto-extracts storeId from req.store
  action: 'LOGIN_SUCCESS',
  entityType: 'User',
  entityId: user._id.toString(),
  description: 'User logged in successfully',
  metadata: {
    email: user.email,
    role: user.role,
    storeId: resolvedStoreId, // Included in metadata for reference
  },
});
```

### 2. Login Failed (no user found)
```typescript
await logAudit({
  req,
  actorRole: 'reseller', // Default role (no user found)
  action: 'LOGIN_FAILED',
  entityType: 'User',
  description: `Failed login attempt for email: ${email}`,
  metadata: {
    email,
    reason: 'user_not_found',
  },
});
```

### 3. Account Locked
```typescript
await logAudit({
  req,
  actorId: user._id.toString(),
  actorRole: user.role,
  action: 'ACCOUNT_LOCKED',
  entityType: 'User',
  entityId: user._id.toString(),
  description: `Account locked due to ${user.failedLoginAttempts} failed login attempts`,
  metadata: {
    email: user.email,
    failedAttempts: user.failedLoginAttempts,
    lockUntil: lockUntil.toISOString(),
  },
});
```

### 4. Update with Before/After Snapshots
```typescript
const oldPricingRule = await PricingRule.findById(ruleId).lean();

// ... update logic ...

await logAudit({
  req,
  action: 'PRICING_RULE_UPDATED',
  entityType: 'PricingRule',
  entityId: ruleId,
  before: oldPricingRule, // Snapshot before change
  after: updatedPricingRule, // Snapshot after change
  description: 'Pricing rule updated',
  metadata: {
    changedFields: Object.keys(req.body),
  },
});
```

### 5. Create Operation
```typescript
const newProduct = await Product.create(productData);

await logAudit({
  req,
  action: 'PRODUCT_CREATED',
  entityType: 'Product',
  entityId: newProduct._id.toString(),
  after: newProduct.toObject(), // Snapshot of created entity
  description: 'Product created',
  metadata: {
    productName: newProduct.name,
    categoryId: newProduct.categoryId.toString(),
  },
});
```

### 6. Delete Operation
```typescript
const product = await Product.findById(productId).lean();

await Product.findByIdAndDelete(productId);

await logAudit({
  req,
  action: 'PRODUCT_DELETED',
  entityType: 'Product',
  entityId: productId,
  before: product, // Snapshot before deletion
  description: 'Product deleted',
  metadata: {
    productName: product.name,
  },
});
```

### 7. System Action (Automated Job)
```typescript
await logAudit({
  req: undefined, // No request for system actions
  actorRole: 'system',
  action: 'PRICING_INSIGHT_GENERATED',
  entityType: 'PricingInsight',
  description: 'Automated pricing insight generated',
  metadata: {
    jobId: 'pricing-insight-job-123',
    productsAnalyzed: 150,
  },
});
```

---

## 🎯 Using Audit Middleware

### Basic Usage
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

### Pre-configured Middlewares
```typescript
import { auditMiddlewares } from '../middleware/auditMiddleware';

// Create
router.post('/products',
  authenticate,
  resolveStore,
  auditMiddlewares.onCreate('Product'),
  createProduct
);

// Update
router.patch('/products/:id',
  authenticate,
  resolveStore,
  auditMiddlewares.onUpdate('Product'),
  updateProduct
);

// Delete
router.delete('/products/:id',
  authenticate,
  resolveStore,
  auditMiddlewares.onDelete('Product'),
  deleteProduct
);

// Login
router.post('/auth/login',
  auditMiddlewares.onLogin(),
  login
);

// Logout
router.post('/auth/logout',
  authenticate,
  auditMiddlewares.onLogout(),
  logout
);
```

---

## 🔍 Querying Audit Logs

### Get All Logs for a Store
```bash
GET /api/admin/audit-logs?storeId=123&page=1&limit=50
```

### Get Logs by Action
```bash
GET /api/admin/audit-logs?action=LOGIN_SUCCESS&storeId=123
```

### Get Logs by Actor
```bash
GET /api/admin/audit-logs?actorId=456&storeId=123
```

### Get Logs for Specific Entity
```bash
GET /api/admin/audit-logs?entityType=Product&entityId=789&storeId=123
```

### Get Logs in Date Range
```bash
GET /api/admin/audit-logs?dateFrom=2024-01-01&dateTo=2024-01-31&storeId=123
```

---

## ✅ Summary

**All audit log calls in `auth.controller.ts` updated:**
- ✅ Uses new API with `req` parameter
- ✅ Auto-extracts `storeId` from `req.store`
- ✅ Auto-extracts `actorId` from `req.user`
- ✅ Auto-extracts IP and user agent from `req`
- ✅ Backward compatible (legacy `actorUserId` still works)

**Ready for production!** 🎉

