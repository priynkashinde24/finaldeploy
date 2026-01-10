# AOV Reports (Admin) — Specs, APIs, and Performance

## AOV Definition
\[
\text{AOV} = \frac{\text{Total Revenue}}{\text{Total Completed Orders}}
\]

### Completed orders (assumption)
This implementation treats **completed** as:
- `orderStatus in ['confirmed', 'delivered']`

> If your business defines “completed” differently (e.g., only `delivered`), change the constant in the controller.

## Backend — APIs implemented
Files:
- `api/src/controllers/aovReports.controller.ts`
- `api/src/routes/aovReports.routes.ts`
- mounted in `api/src/app.ts`

All endpoints require:
- `Authorization: Bearer <token>`
- store resolution (`x-store-id` header or subdomain/domain) via `resolveStore`
- admin role (enforced in controller)

### 1) GET `/api/analytics/aov/overview`
Query:
- `startDate=YYYY-MM-DD` (optional)
- `endDate=YYYY-MM-DD` (optional)

Returns:
- `aov`, `totalRevenue`, `totalCompletedOrders`, `growthPercent`
- growth is calculated vs previous period of equal length

### 2) GET `/api/analytics/aov/trend?interval=daily|weekly|monthly`
Query:
- `interval` (default: `daily`)
- `startDate`, `endDate` (optional)

Returns:
- points: `{ date, revenue, orders, aov }`

### 3) GET `/api/analytics/aov/by-category`
Query:
- `startDate`, `endDate` (optional)

Definition used for this report:
- `categoryRevenue = sum(items.totalPrice)` for completed orders in range
- `categoryOrders = distinct orders that included that category`
- `categoryAOV = categoryRevenue / categoryOrders`

### 4) GET `/api/analytics/aov/by-channel`
Query:
- `startDate`, `endDate` (optional)

Channel derivation:
- `order.marketingAttribution.lastTouch.channel`
- fallback `order.marketingAttribution.firstTouch.channel`
- fallback `'direct'`

### 5) GET `/api/analytics/aov/high-value-orders`
Query:
- `page` (default 1)
- `limit` (default 10, max 100)
- `minTotal` (default 0)
- `startDate`, `endDate` (optional)

Returns paginated “high value” completed orders (sorted by total desc).

## Aggregation pipeline examples (high level)

### Overview (snapshot aggregation)
- `$match` AOV snapshots for storeId + admin scope + date range
- `$group` sum `grossRevenue` + `ordersCount`
- compute \(aov = revenue/orders\)

### Trend (weekly/monthly)
- `$dateFromString` on daily snapshot `date` (YYYY-MM-DD)
- `$dateTrunc` to week/month buckets
- `$group` sum `revenue` + `orders`
- compute bucket AOV

### Category breakdown (orders + lookups)
- `$match` completed orders in date range
- `$unwind` items
- `$lookup` products → categories
- `$group` by category and compute:
  - revenue sum
  - distinct order ids set
- `$project` completedOrders size + aov = revenue/completedOrders

### Channel breakdown
- `$match` completed orders in date range
- `$project` channel via `$ifNull` chain
- `$group` by channel to sum revenue and orders

### High value orders (table)
- `$match` completed orders + date range
- `$addFields` total from `totalAmountWithTax` fallback `grandTotal`
- `$match` total >= minTotal
- `$sort` total desc
- `$facet` for pagination + total count

## Performance notes

### What is optimized already
- **Pre-aggregation** for AOV exists via `AOVSnapshot` (`api/src/jobs/aovSnapshot.job.ts`)
  - It explicitly uses only `confirmed/delivered` orders.
- This report layer uses:
  - snapshots for overview/trend (fast)
  - aggregation pipelines for category/channel/high-value (still efficient)
- Adds a **60s in-memory TTL cache** for overview/trend/category/channel endpoints to reduce repeated heavy queries.

### Index recommendations
In addition to existing indexes, these help most:
- `orders`: `{ storeId: 1, orderStatus: 1, createdAt: -1 }`
- `orders`: `{ storeId: 1, createdAt: -1 }`
- `orders`: `{ storeId: 1, createdAt: -1, totalAmountWithTax: -1 }` *(optional)* for high-value tables
- `AOVSnapshot`: already indexed by `{ storeId, scope, date }`

## Frontend (Admin UI)
File:
- `frontend/src/app/admin/analytics/aov/page.tsx`

Features:
- KPI cards (AOV, revenue, completed orders, growth%)
- AOV trend chart (interval toggle)
- AOV by category (bar)
- AOV by channel (bar)
- High-value orders table with pagination + min-total filter


