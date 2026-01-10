# Analytics Dashboard (Admin) — Specs, APIs, and Structure

This repo already contains snapshot-based analytics (sales + conversion). This document adds a **SaaS-style Admin Sales Dashboard** with:
- **Cards**: Total Revenue, Total Orders, Average Order Value, Revenue Growth %
- **Charts**: Revenue over time (daily/weekly/monthly), Sales by category, Order status distribution
- **Table**: Recent orders with pagination + filters

## Folder structure

### Backend (API)
- `api/src/controllers/analyticsDashboard.controller.ts`
  - Implements the requested endpoints using snapshots + aggregation pipelines + TTL caching.
- `api/src/routes/analyticsDashboard.routes.ts`
  - Routes under `/api/analytics/*`
- `api/src/controllers/salesAnalytics.controller.ts`
  - Existing endpoints: `/api/analytics/summary`, `/api/analytics/timeseries`, `/api/analytics/top-products`, `/api/analytics/export`
- `api/src/models/SalesAnalyticsSnapshot.ts`
  - **Pre-aggregated** daily sales snapshots (recommended for performance)
- `api/src/models/Order.ts`, `api/src/models/Product.ts`, `api/src/models/Category.ts`
  - Used for category breakdown and recent orders table

### Frontend
- `frontend/src/app/admin/analytics/page.tsx`
  - Admin Sales Dashboard page (cards + charts + table)
- `frontend/src/components/charts/ChartCard.tsx`
  - Small reusable wrapper for chart panels (Card + header + right-side controls)
- `frontend/src/lib/api.ts`
  - Adds `analyticsDashboardAPI` client.

## Sample schema (MongoDB / Mongoose)

### Sales snapshot (pre-aggregated)
Model: `SalesAnalyticsSnapshot`

Key fields (simplified):
- `storeId`: ObjectId
- `scope`: `"admin" | "supplier" | "reseller"`
- `entityId`: `null | ObjectId | string`
- `date`: `"YYYY-MM-DD"`
- `ordersCount`: number
- `grossRevenue`: number

### Orders (for table + category/status breakdown)
Model: `Order`

Key fields (simplified):
- `storeId`: ObjectId
- `orderNumber`: string
- `customerName`: string
- `customerEmail`: string
- `orderStatus`: string
- `paymentStatus`: string
- `paymentMethod`: string
- `totalAmountWithTax`: number
- `createdAt`: Date
- `items[]`: `{ globalProductId, sku, name, quantity, totalPrice }`

## Backend APIs (implemented)

All routes are mounted under `/api` and require:
- `Authorization: Bearer <token>`
- store resolution (`x-store-id` header) via `resolveStore` middleware
- Admin role (enforced in controller)

### 1) GET `/api/analytics/overview`
Query:
- `startDate=YYYY-MM-DD` (optional)
- `endDate=YYYY-MM-DD` (optional)

Response:
```json
{
  "success": true,
  "data": {
    "totalRevenue": 12345,
    "totalOrders": 321,
    "averageOrderValue": 38.46,
    "revenueGrowthPercent": 12.4,
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31", "previousStart": "2025-12-01", "previousEnd": "2026-01-01" }
  }
}
```

### 2) GET `/api/analytics/revenue?range=daily|weekly|monthly`
Response:
```json
{
  "success": true,
  "data": {
    "range": "weekly",
    "data": [{ "date": "2026-01-01", "revenue": 1234 }],
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31" }
  }
}
```

### 3) GET `/api/analytics/categories`
Response:
```json
{
  "success": true,
  "data": {
    "categories": [{ "categoryId": "…", "categoryName": "Electronics", "revenue": 999, "quantity": 42 }],
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31" }
  }
}
```

### 4) GET `/api/analytics/order-status`
Response:
```json
{
  "success": true,
  "data": {
    "statuses": [{ "status": "delivered", "count": 12 }],
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31" }
  }
}
```

### 5) GET `/api/analytics/orders`
Query:
- `page` (default 1)
- `limit` (default 10)
- `orderStatus` (optional)
- `paymentStatus` (optional)
- `q` (optional search across orderNumber / customerEmail / customerName)

Response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "orderId": "…",
        "orderNumber": "ORD-…",
        "customerName": "Jane",
        "customerEmail": "jane@x.com",
        "orderStatus": "delivered",
        "paymentStatus": "paid",
        "paymentMethod": "stripe",
        "grandTotal": 199,
        "createdAt": "2026-01-09T10:00:00.000Z",
        "itemsCount": 3
      }
    ],
    "page": 1,
    "limit": 10,
    "total": 120,
    "totalPages": 12,
    "dateRange": { "start": "2026-01-01", "end": "2026-01-31" }
  }
}
```

## Performance best practices (recommended)

### What we do now
- Use `SalesAnalyticsSnapshot` for overview + revenue chart (fast, pre-aggregated).
- Use MongoDB aggregation pipelines for:
  - category sales
  - order status distribution
  - recent orders + count via `$facet`
- Add a **60s TTL in-memory cache** for overview/revenue/categories/status endpoints.

### What to do next (production-grade)
- Add cron-based jobs (hourly/daily) to pre-aggregate:
  - category revenue per day/week/month
  - order-status counts per day/week/month
- Store them in snapshot collections so dashboards are constant-time reads.


