# Marketing Channel Attribution (UTM + Sessions) — Specs

## Goals
- Track **sessions** with UTM parameters: `source`, `medium`, `campaign`, and resolve a normalized **channel**.
- Support attribution models:
  - **first-touch**
  - **last-touch**
  - **linear** (multi-touch)
  - (existing) **time-decay** (multi-touch)
- Pre-aggregate daily attribution metrics to avoid expensive multi-touch computation at query time.

## Data Model (Schema Assumptions)

### 1) `MarketingTouch` (immutable)
File: `api/src/models/MarketingTouch.ts`

- **Key fields**
  - `storeId`
  - `sessionId` (string; shared with `mk_session`)
  - `channel` (normalized, from `resolveChannel()`)
  - UTM: `source`, `medium`, `campaign`, `content`, `term`
  - `landingPage`, `referrerUrl`, `referrerDomain`
  - `occurredAt`

- **Indexes (already present)**
  - `(storeId, sessionId, occurredAt)`
  - `(storeId, channel, occurredAt)`
  - `(storeId, userId, occurredAt)`

### 2) `AttributionSession`
File: `api/src/models/AttributionSession.ts`

- Links all touches within a session:
  - `sessionId`
  - `firstTouchId`, `lastTouchId`
  - `allTouchIds[]`
  - `startedAt`, `lastActivityAt`, `endedAt`

- **Index guidance**
  - `(storeId, sessionId)` unique
  - `(storeId, userId, startedAt)` for user-linked sessions

### 3) `Order.marketingAttribution` (immutable snapshot)
File: `api/src/models/Order.ts`

- Stores the attribution snapshot at order creation time:
  - `firstTouch`, `lastTouch` (touchId + channel/source/medium/campaign + occurredAt)
  - `channelCredits[]` (used by multi-touch attribution)

> Note: Orders may have `marketingAttribution=null` if the user never generated a marketing session/touch.

### 4) `AttributionSnapshot` (daily)
File: `api/src/models/AttributionSnapshot.ts`

- One row per `(storeId, date, channel, attributionModel)`:
  - `visits`, `uniqueVisitors`
  - `orders`, `revenue`
  - `conversionRate`, `averageOrderValue`
  - optional `cost`, `roi`

## Attribution Logic

### Channel Resolution
File: `api/src/utils/attributionEngine.ts`

Inputs:
- UTM params: `utm_source`, `utm_medium`, `utm_campaign`
- `referrerDomain`

Outputs:
- `channel` enum (paid_search, paid_social, organic_search, email, referral, direct, ...)

### Attribution Models
- **first-touch**: 100% credit to earliest touch in session
- **last-touch**: 100% credit to most recent touch in session
- **linear**: equal split across all touches in session
- **time-decay**: exponential weighting by recency (24h decay constant)

Implementation:
- `calculateAttribution(sessionId, model)` in `api/src/utils/attributionEngine.ts`

## Pre-aggregation (Cron/Snapshot Job)

### Daily snapshot generation
File: `api/src/jobs/attributionSnapshot.job.ts`

Inputs:
- All `MarketingTouch` within the day (for “visits”)
- All completed orders within the day with `marketingAttribution`
- Optional marketing cost rows `MarketingCost` for ROI

Key behavior:
- For **linear/time-decay**, revenue is **split across channels** using computed credits (job-time).
- Output: `AttributionSnapshot` rows written once per day (immutable).

Scheduler:
- `api/src/server.ts` runs `runAttributionSnapshotGeneration()` hourly + daily.

## APIs

Routes file: `api/src/routes/attributionAnalytics.routes.ts`

- **GET** `/api/analytics/attribution/overview`
  - Alias of existing `/analytics/attribution/summary`
  - Query: `startDate`, `endDate`, `attributionModel`

- **GET** `/api/analytics/attribution/by-channel`
  - Alias of existing `/analytics/attribution/channels`
  - Query: `startDate`, `endDate`, `attributionModel`, optional `channel`

- **GET** `/api/analytics/attribution/models-compare`
  - Alias of existing `/analytics/attribution/compare`
  - Query: `startDate`, `endDate`

- **GET** `/api/analytics/attribution/paths`
  - Top conversion paths (channel sequences) derived by:
    - order → marketingAttribution.touchId → `MarketingTouch.sessionId`
    - session → `AttributionSession.allTouchIds` → touches → channel path
  - Query: `startDate`, `endDate`, `attributionModel`, `limit`

Caching:
- `api/src/controllers/attributionAnalytics.controller.ts` uses in-memory TTL (60s) per endpoint key.

## Frontend Dashboard

Page:
- `frontend/src/app/admin/analytics/attribution/page.tsx`

What it shows:
- KPI cards (visits, orders, revenue, ROI)
- Channel performance table
- Revenue time-series chart
- Model comparison bar chart
- Top conversion paths table
- Attribution model switcher + date range filters

## Tracking Ingestion (Frontend → Backend)

Frontend:
- `frontend/src/lib/marketingTracker.ts`
- Initialized in `frontend/src/components/providers/AppProviders.tsx`

Backend ingestion:
- `POST /api/tracking/marketing-touch` (`api/src/controllers/marketingTracking.controller.ts`)
- Sets **HTTP-only** `mk_session` cookie for downstream order attribution.

## Scaling / Performance Best Practices
- **Indexes**: keep `MarketingTouch(sessionId, occurredAt)` and `AttributionSession(sessionId)` hot.
- **No live multi-touch**: multi-touch credit computation happens in the **snapshot job**, not per API request.
- **Batching**: for very high volume, compute session credits in batches or store precomputed `sessionCredits` per session/day.
- **Distributed cache**: swap in-memory TTL cache for Redis if running multiple API instances.


