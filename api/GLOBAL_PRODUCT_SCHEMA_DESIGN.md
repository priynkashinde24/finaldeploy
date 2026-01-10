# Global Product Base Schema - Design Documentation

## Overview

This document explains the Global Product Base Schema architecture, designed to be a single source of truth for products while allowing suppliers to manage inventory and resellers to set pricing independently.

## Architecture Diagram

```
ADMIN
  └── Product (global)
      ├── name, description, images
      ├── basePrice (reference price)
      ├── category, brand
      └── status: active/inactive
      └── createdBy: admin

SUPPLIER
  └── SupplierProduct (inventory + cost)
      ├── productId → references Product
      ├── variantId → optional ProductVariant
      ├── costPrice (supplier's cost)
      ├── stockQuantity (available stock)
      ├── minOrderQty
      └── status: active/inactive

RESELLER
  └── ResellerProduct (margin + selling price)
      ├── productId → references Product
      ├── variantId → optional ProductVariant
      ├── supplierId → which supplier to source from
      ├── sellingPrice (reseller's price to customers)
      ├── margin (percentage markup)
      └── status: active/inactive
```

### Data Flow

1. **Admin** creates `Product` → Global catalog entry
2. **Supplier** creates `SupplierProduct` → Maps inventory to Product
3. **Reseller** creates `ResellerProduct` → Sets pricing from SupplierProduct

### Ownership

- **Admin owns:** Product, ProductVariant
- **Supplier owns:** SupplierProduct (their inventory mappings)
- **Reseller owns:** ResellerProduct (their pricing mappings)

---

## Architecture Principles

### 1. Single Source of Truth
- **Product** model contains global product information
- Created ONLY by admins
- Referenced by suppliers (inventory) and resellers (pricing)
- Prevents product duplication

### 2. Separation of Concerns
- **Product**: Global product data (name, description, images, base price)
- **SupplierProduct**: Supplier-specific inventory (stock, cost price)
- **ResellerProduct**: Reseller-specific pricing (selling price, margin)
- **ProductVariant**: Optional SKU-level variants (size, color, etc.)

### 3. Data Ownership
- **Admin** owns `Product` and `ProductVariant`
- **Supplier** owns `SupplierProduct` (their inventory mappings)
- **Reseller** owns `ResellerProduct` (their pricing mappings)
- Never mix ownership fields

---

## Schema Models

### 1. Product (Global Products)

**File:** `/api/src/models/Product.ts`

**Purpose:** Single source of truth for all products

**Fields:**
- `name` (string, required) - Product name
- `slug` (string, unique, indexed) - URL-friendly identifier
- `description` (string) - Product description
- `category` (string, indexed) - Product category
- `brand` (string) - Brand name
- `images` (array of strings) - Product images
- `basePrice` (number) - Admin-defined reference price
- `status` ('active' | 'inactive') - Product status
- `createdBy` (ObjectId) - Admin who created the product

**Rules:**
- Created ONLY by admins
- No supplier-specific data
- No stock/quantity
- No reseller pricing

**Indexes:**
- `slug` (unique)
- `status`, `category` (compound)
- `createdBy`, `status` (compound)
- Text search on `name`, `description`, `brand`

---

### 2. ProductVariant (Optional SKUs)

**File:** `/api/src/models/ProductVariant.ts`

**Purpose:** Multiple SKUs for the same product (e.g., sizes, colors)

**Fields:**
- `productId` (ObjectId, ref Product) - Parent product
- `sku` (string, unique) - Variant SKU
- `attributes` (object) - Flexible attributes (size, color, weight, etc.)
- `basePrice` (number) - Variant-specific price
- `images` (array of strings) - Variant-specific images
- `status` ('active' | 'inactive')

**Rules:**
- Created by admin (same as Product)
- Referenced by SupplierProduct/ResellerProduct when variant-specific
- Variant images override product images when specified

**Indexes:**
- `sku` (unique)
- `productId`, `status` (compound)

---

### 3. SupplierProduct (Supplier Inventory Mapping)

**File:** `/api/src/models/SupplierProduct.ts`

**Purpose:** Maps supplier inventory to global products

**Fields:**
- `supplierId` (ObjectId, ref User) - Supplier
- `productId` (ObjectId, ref Product) - Global product
- `variantId` (ObjectId, optional, ref ProductVariant) - Optional variant
- `supplierSku` (string) - Supplier's own SKU
- `costPrice` (number) - Supplier's cost price
- `stockQuantity` (number) - Available stock
- `minOrderQty` (number) - Minimum order quantity
- `status` ('active' | 'inactive')

**Rules:**
- Supplier cannot create products (only map to existing)
- One supplier → many products (one-to-many)
- One product → many suppliers (many-to-many via multiple records)
- Unique constraint: `supplierId + productId + variantId`

**Indexes:**
- `supplierId + productId + variantId` (unique, sparse)
- `supplierId`, `status`, `stockQuantity` (compound)
- `productId`, `status` (compound)

**Validation:**
- Product must exist and be active
- Variant (if provided) must exist, be active, and belong to product

---

### 4. ResellerProduct (Reseller Pricing Mapping)

**File:** `/api/src/models/ResellerProduct.ts`

**Purpose:** Maps reseller pricing to global products

**Fields:**
- `resellerId` (ObjectId, ref User) - Reseller
- `productId` (ObjectId, ref Product) - Global product
- `variantId` (ObjectId, optional, ref ProductVariant) - Optional variant
- `supplierId` (ObjectId, ref User) - Which supplier they're sourcing from
- `sellingPrice` (number) - Reseller's selling price
- `margin` (number) - Margin percentage (e.g., 20 = 20% markup)
- `status` ('active' | 'inactive')

**Rules:**
- Reseller cannot create products (only map to existing)
- Reseller selects supplier product and sets margin
- No stock stored here (stock comes from SupplierProduct)
- Unique constraint: `resellerId + productId + variantId + supplierId`

**Indexes:**
- `resellerId + productId + variantId + supplierId` (unique, sparse)
- `resellerId`, `status` (compound)
- `productId`, `status` (compound)
- `supplierId`, `status` (compound)

**Validation:**
- Product must exist and be active
- Variant (if provided) must exist, be active, and belong to product
- Supplier must have active inventory for this product

**Pricing Logic:**
- `sellingPrice = supplierProduct.costPrice * (1 + margin/100)`
- Margin is percentage (e.g., 20 = 20% markup)

---

## Status Flow & Availability

### Product Availability Logic

A product is available for reseller to sell when **ALL** of the following are true:

1. **Product** must be `active`
2. **SupplierProduct** must be `active` AND `stockQuantity > 0`
3. **ResellerProduct** must be `active`

**Frontend availability depends on ALL three conditions.**

```
Product Availability Check:
┌─────────────────────────────────────────┐
│  Product.status === 'active'            │ ← Admin controls
├─────────────────────────────────────────┤
│  SupplierProduct.status === 'active'    │ ← Supplier controls
│  AND stockQuantity > 0                  │
├─────────────────────────────────────────┤
│  ResellerProduct.status === 'active'    │ ← Reseller controls
└─────────────────────────────────────────┘
         ↓
    AVAILABLE ✅
```

---

## Indexes & Constraints

### Unique Constraints

1. **Product.slug** - Prevents duplicate global products
2. **SupplierProduct** (`supplierId + productId + variantId`) - Prevents duplicate supplier mappings
3. **ResellerProduct** (`resellerId + productId + variantId + supplierId`) - Prevents duplicate reseller listings

### Performance Indexes

- Product: `status`, `category`, `createdBy`, text search
- SupplierProduct: `supplierId`, `productId`, `status`, `stockQuantity`
- ResellerProduct: `resellerId`, `productId`, `supplierId`, `status`

---

## API Endpoints (Scaffold)

**File:** `/api/src/controllers/adminProduct.controller.ts`
**Routes:** `/api/src/routes/admin.product.routes.ts`
**Mounted:** `/api/admin/products`

### Endpoints (Admin Only)

- `POST /api/admin/products` - Create product (TODO: implement)
- `GET /api/admin/products` - List products (partially implemented)
- `GET /api/admin/products/:id` - Get product (implemented)
- `PATCH /api/admin/products/:id` - Update product (TODO: implement)
- `DELETE /api/admin/products/:id` - Delete product (TODO: implement)

**Protection:** All routes require admin authentication and authorization.

---

## Future Extensions (Designed But Not Implemented)

The schema is designed to support future features:

### 1. Category Tree
- `category` field ready for hierarchy
- Can add `parentCategory` field later

### 2. GST / Tax Slabs
- Can add `taxCategory` field to Product
- Can add `gstRate` field

### 3. Shipping Weight
- Can add `weight` field to Product/ProductVariant
- Can add `dimensions` object

### 4. Multi-Warehouse Stock
- Can add `warehouseId` array to SupplierProduct
- Can add `warehouseStock` object

### 5. Product Attributes
- `attributes` object in ProductVariant is flexible
- Can extend to Product model if needed

### 6. SEO Metadata
- Can add `seo` object with `title`, `description`, `keywords`
- Can add `metaTags` array

---

## Data Ownership Rules

### Clear Ownership Boundaries

1. **Admin owns:**
   - Product
   - ProductVariant

2. **Supplier owns:**
   - SupplierProduct (their inventory mappings)
   - Cannot create/modify Product
   - Can only map inventory to existing products

3. **Reseller owns:**
   - ResellerProduct (their pricing mappings)
   - Cannot create/modify Product
   - Can only set pricing for existing products

### Never Mix Ownership

- Product model has NO supplier-specific fields
- Product model has NO reseller-specific fields
- SupplierProduct has NO reseller-specific fields
- ResellerProduct has NO supplier-specific fields

---

## Why This Design?

### 1. Why Product is Global?

**Problem:** Without global products, each supplier/reseller would create their own product entries, leading to:
- Duplicate products (same product, different entries)
- Inconsistent product data
- Difficult product search/browsing
- No unified catalog

**Solution:** Single Product model ensures:
- One product = one entry
- Consistent product information
- Unified catalog
- Easy product discovery

### 2. Why Inventory is Separate?

**Problem:** If stock was in Product model:
- Multiple suppliers couldn't have different stock levels
- Stock would be shared (incorrect)
- Supplier-specific pricing couldn't be tracked

**Solution:** SupplierProduct model allows:
- Each supplier has their own stock
- Each supplier has their own cost price
- Multiple suppliers can supply same product
- Stock is supplier-specific

### 3. Why Pricing is Layered?

**Problem:** If pricing was in Product model:
- Resellers couldn't set different prices
- Margins couldn't be tracked
- Supplier cost vs reseller price would be mixed

**Solution:** Layered pricing:
- Product.basePrice = admin reference price
- SupplierProduct.costPrice = supplier cost
- ResellerProduct.sellingPrice = reseller selling price
- ResellerProduct.margin = reseller margin

This allows:
- Multiple resellers with different prices
- Margin tracking
- Clear pricing hierarchy

---

## Example Flow

### 1. Admin Creates Product
```
Admin creates: Product(name="T-Shirt", basePrice=500)
```

### 2. Supplier Maps Inventory
```
Supplier A creates: SupplierProduct(
  productId="T-Shirt",
  costPrice=300,
  stockQuantity=100
)
```

### 3. Reseller Lists Product
```
Reseller X creates: ResellerProduct(
  productId="T-Shirt",
  supplierId="Supplier A",
  sellingPrice=450,
  margin=50  // 50% markup
)
```

### 4. Customer Sees Product
- Product: "T-Shirt" (from Product)
- Price: ₹450 (from ResellerProduct)
- Stock: Available (from SupplierProduct.stockQuantity > 0)

---

## Status: Complete

All models created with:
- ✅ Proper schema definitions
- ✅ Indexes and constraints
- ✅ Validation hooks
- ✅ Documentation comments
- ✅ Admin API scaffold
- ✅ Future extension hooks

**Ready for implementation of business logic!**

