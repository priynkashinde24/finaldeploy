# Conversion Funnel Dashboard — Session-Based Tracking

This repo already had snapshot-based conversion analytics. This upgrade adds **session-based funnel analytics** using an immutable `FunnelEvent` log with `sessionId`, correct event ordering, and filter support.

## Funnel events tracked
- `PAGE_VIEW`
- `PRODUCT_VIEW`
- `ADD_TO_CART`
- `CHECKOUT_STARTED`
- `PAYMENT_SUCCESS` (legacy fallback: `ORDER_CONFIRMED`)

## Backend APIs (implemented)

All endpoints are under `/api` and require auth + store resolution **except** the public ingestion endpoint.

### Public ingestion
**POST** `/api/analytics/conversion/event`

- CSRF-exempt (added to CSRF middleware public routes)
- Uses `x-store-id` header (recommended) or store resolution via domain/subdomain

Body:
```json
{
  "sessionId": "sess_...",
  "eventType": "PAGE_VIEW",
  "entityId": "optional",
  "occurredAt": "2026-01-09T12:00:00.000Z",
  "device": "mobile",
  "source": "google",
  "pagePath": "/products/abc",
  "metadata": {}
}
```

### Dashboard endpoints
**GET** `/api/analytics/conversion/overview`
- Query: `startDate`, `endDate`, `device`, `source`
- Returns KPI summary + computed ordered funnel.

**GET** `/api/analytics/conversion/funnel`
- Same query as overview
- Returns ordered funnel steps with drop-off%.

**GET** `/api/analytics/conversion/trend`
- Query: `startDate`, `endDate`, `device`, `source`, `interval=daily|weekly|monthly`
- Returns conversion rate over time based on sessions.

**GET** `/api/analytics/conversion/breakdown`
- Query: `startDate`, `endDate`, `device`, `source`, `groupBy=device|source`
- Returns sessions/converted/conversionRate by group.

## Schema design
File: `api/src/models/FunnelEvent.ts`

Key fields:
- `storeId` (ObjectId)
- `sessionId` (string)
- `eventType` (enum)
- `occurredAt` (Date) — preferred timestamp for analytics
- `device` (desktop/mobile/tablet/unknown)
- `source` (utm_source or referrer domain)
- `entityId` (optional)
- `metadata` (optional)

## Aggregation pipeline approach (high level)

### Ordered funnel per session
1. `$match` by storeId + date range + filters + relevant eventTypes
2. `$group` by `sessionId` and compute min timestamps per step (`pageAt`, `productAt`, etc.)
3. `$project` boolean flags like `reachedProduct = productAt >= pageAt`
4. `$group` again to count sessions per step

### Trend
1. `$group` by `sessionId` to compute `pageAt` and `payAt`
2. `$project` bucket date based on `pageAt` using `$dateTrunc`
3. `$group` by bucket to count sessions + converted

## Index recommendations
Already added in `FunnelEvent`:
- `{ storeId: 1, occurredAt: -1 }`
- `{ storeId: 1, eventType: 1, occurredAt: -1 }`
- `{ storeId: 1, source: 1, occurredAt: -1 }`
- `{ storeId: 1, device: 1, occurredAt: -1 }`
- `{ storeId: 1, sessionId: 1, createdAt: -1 }` (legacy)

## Daily pre-aggregation strategy (recommended)
For high traffic, compute daily session funnels into a snapshot collection:
- keys: `storeId`, `date`, `device?`, `source?`
- metrics: sessions, productSessions, cartSessions, checkoutSessions, paymentSessions, conversionRate

Then dashboards read snapshots instead of raw events.

## Frontend
- Updated admin page: `frontend/src/app/admin/analytics/conversion/page.tsx`
- Added tracker: `frontend/src/lib/funnelTracker.ts`
- Initializes PAGE_VIEW tracking in `frontend/src/components/providers/AppProviders.tsx`


