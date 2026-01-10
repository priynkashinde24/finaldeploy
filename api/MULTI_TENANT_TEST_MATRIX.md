# Multi-Tenant System - Test Matrix

## 🧪 Test Scenarios

### ✅ Test 1: Same User, Different Stores → Isolated Data

**Setup:**
- Create User A
- Create Store 1, assign User A as owner
- Create Store 2, assign User A in accessibleStores
- Create Product 1 in Store 1
- Create Product 2 in Store 2

**Test:**
1. Login as User A with `x-store-id: Store1`
2. GET `/api/products` → Should return only Product 1
3. Login as User A with `x-store-id: Store2`
4. GET `/api/products` → Should return only Product 2

**Expected:** ✅ Data is isolated per store

---

### ✅ Test 2: Wrong storeId → Access Denied

**Setup:**
- Create User A
- Create Store 1, assign User A as owner
- Create Store 2 (User A has NO access)
- Create Product in Store 2

**Test:**
1. Login as User A
2. GET `/api/products` with `x-store-id: Store2`
3. Should receive 403 Forbidden

**Expected:** ✅ Access denied for unauthorized store

---

### ✅ Test 3: Store Suspended → Blocked

**Setup:**
- Create Store 1 with status: 'active'
- Create Store 2 with status: 'suspended'
- Create Products in both stores

**Test:**
1. GET `/api/storefront/products` with subdomain for Store 1 → Should work
2. GET `/api/storefront/products` with subdomain for Store 2 → Should return 403

**Expected:** ✅ Suspended stores are blocked

---

### ✅ Test 4: Orders & Pricing Scoped Correctly

**Setup:**
- Create Store 1 and Store 2
- Create Product A in Store 1 (price: ₹100)
- Create Product A in Store 2 (price: ₹200)
- Create Order 1 in Store 1
- Create Order 2 in Store 2

**Test:**
1. GET `/api/orders` with `x-store-id: Store1` → Should return only Order 1
2. GET `/api/orders` with `x-store-id: Store2` → Should return only Order 2
3. GET `/api/storefront/products` for Store 1 → Product A should show ₹100
4. GET `/api/storefront/products` for Store 2 → Product A should show ₹200

**Expected:** ✅ Orders and pricing are scoped to store

---

### ✅ Test 5: No Data Leakage Across Stores

**Setup:**
- Create Store 1 and Store 2
- Create Coupon "SAVE10" in Store 1
- Create Coupon "SAVE20" in Store 2
- Create Promotion "SUMMER" in Store 1
- Create Promotion "WINTER" in Store 2

**Test:**
1. GET `/api/coupons` with `x-store-id: Store1` → Should return only "SAVE10"
2. GET `/api/coupons` with `x-store-id: Store2` → Should return only "SAVE20"
3. GET `/api/promotions` with `x-store-id: Store1` → Should return only "SUMMER"
4. GET `/api/promotions` with `x-store-id: Store2` → Should return only "WINTER"

**Expected:** ✅ No cross-store data leakage

---

### ✅ Test 6: Admin Can Access All Stores

**Setup:**
- Create Admin User
- Create Store 1, Store 2, Store 3
- Create Products in each store

**Test:**
1. Login as Admin
2. GET `/api/products` with `x-store-id: Store1` → Should work
3. GET `/api/products` with `x-store-id: Store2` → Should work
4. GET `/api/products` with `x-store-id: Store3` → Should work
5. GET `/api/admin/stores` → Should return all stores

**Expected:** ✅ Admin has access to all stores

---

### ✅ Test 7: Store Owner Can Access Their Store

**Setup:**
- Create User A
- Create Store 1, assign User A as owner
- Create Products in Store 1

**Test:**
1. Login as User A
2. GET `/api/products` with `x-store-id: Store1` → Should work
3. GET `/api/stores/:storeId` → Should return Store 1

**Expected:** ✅ Store owner has access

---

### ✅ Test 8: User With Access Can Access Store

**Setup:**
- Create User A
- Create Store 1
- Add Store 1 to User A's `accessibleStores`
- Create Products in Store 1

**Test:**
1. Login as User A
2. GET `/api/products` with `x-store-id: Store1` → Should work

**Expected:** ✅ User with access can access store

---

### ✅ Test 9: User Without Access → Denied

**Setup:**
- Create User A
- Create Store 1 (User A has NO access)
- Create Products in Store 1

**Test:**
1. Login as User A
2. GET `/api/products` with `x-store-id: Store1` → Should return 403

**Expected:** ✅ Access denied

---

### ✅ Test 10: Store Resolution Priority

**Setup:**
- Create Store 1 with subdomain: "shop1"
- Create Store 2 with domain: "custom.com"

**Test:**
1. Request with `x-store-id: Store1` header → Should resolve Store 1
2. Request with Host: "shop1.yourapp.com" → Should resolve Store 1
3. Request with Host: "custom.com" → Should resolve Store 2
4. Request with no header/subdomain/domain → Should fail

**Expected:** ✅ Store resolution follows priority: header → subdomain → domain

---

### ✅ Test 11: JWT Contains storeId

**Setup:**
- Create Store 1
- Create User A, assign Store 1 as defaultStoreId

**Test:**
1. Login as User A with Store 1 resolved
2. Decode JWT token
3. Verify JWT contains `storeId: Store1`

**Expected:** ✅ JWT payload includes storeId

---

### ✅ Test 12: Frontend Store Context

**Setup:**
- Deploy frontend
- Create Store 1 with subdomain: "shop1"

**Test:**
1. Visit "shop1.yourapp.com"
2. Check localStorage → Should contain `storeId: Store1`
3. Make API call → Should include `x-store-id: Store1` header

**Expected:** ✅ Frontend automatically resolves and sends storeId

---

### ✅ Test 13: Subscription Per Store

**Setup:**
- Create Store 1 and Store 2
- Create User A
- Create Subscription 1 for Store 1 + User A
- Try to create Subscription 2 for Store 1 + User A (duplicate)

**Test:**
1. Create Subscription 1 → Should succeed
2. Create Subscription 2 → Should fail (unique constraint)

**Expected:** ✅ One subscription per user per store

---

### ✅ Test 14: Analytics Grouped by Store

**Setup:**
- Create Store 1 and Store 2
- Create Orders in both stores

**Test:**
1. GET `/api/analytics/Store1/summary` → Should return only Store 1 metrics
2. GET `/api/analytics/Store2/summary` → Should return only Store 2 metrics

**Expected:** ✅ Analytics are scoped to store

---

### ✅ Test 15: Admin Store Management

**Setup:**
- Create Admin User
- Create Store 1

**Test:**
1. POST `/api/admin/stores` → Should create store
2. GET `/api/admin/stores` → Should list all stores
3. GET `/api/admin/stores/:id` → Should return store details
4. PATCH `/api/admin/stores/:id` → Should update store
5. PATCH `/api/admin/stores/:id/suspend` → Should suspend store
6. PATCH `/api/admin/stores/:id/activate` → Should activate store
7. GET `/api/admin/stores/:id/usage` → Should return usage stats

**Expected:** ✅ Admin can manage all stores

---

## 🎯 Test Execution Checklist

- [ ] Test 1: Same User, Different Stores → Isolated Data
- [ ] Test 2: Wrong storeId → Access Denied
- [ ] Test 3: Store Suspended → Blocked
- [ ] Test 4: Orders & Pricing Scoped Correctly
- [ ] Test 5: No Data Leakage Across Stores
- [ ] Test 6: Admin Can Access All Stores
- [ ] Test 7: Store Owner Can Access Their Store
- [ ] Test 8: User With Access Can Access Store
- [ ] Test 9: User Without Access → Denied
- [ ] Test 10: Store Resolution Priority
- [ ] Test 11: JWT Contains storeId
- [ ] Test 12: Frontend Store Context
- [ ] Test 13: Subscription Per Store
- [ ] Test 14: Analytics Grouped by Store
- [ ] Test 15: Admin Store Management

---

## 🚨 Critical Tests (Must Pass)

These tests are **NON-NEGOTIABLE** for production:

1. ✅ **No cross-store data access** (Test 1, 4, 5)
2. ✅ **Store suspension blocks access** (Test 3)
3. ✅ **Access control enforced** (Test 2, 6, 7, 8, 9)
4. ✅ **Store resolution works** (Test 10)
5. ✅ **JWT includes storeId** (Test 11)

---

## 📝 Test Data Setup Script

Create test data for all scenarios:

```typescript
// scripts/setup-test-data.ts
// Creates test users, stores, products, orders, etc.
```

---

## 🔧 Running Tests

### Manual Testing
1. Use Postman/Thunder Client
2. Set `x-store-id` header
3. Verify responses

### Automated Testing
```bash
npm test -- --testNamePattern="Multi-Tenant"
```

---

## ✅ Success Criteria

All tests must pass before production deployment:
- ✅ Zero data leakage between stores
- ✅ Access control enforced correctly
- ✅ Store resolution works reliably
- ✅ Suspended stores are blocked
- ✅ Admin can manage all stores

