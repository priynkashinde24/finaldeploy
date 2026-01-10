# Request Throttling System Implementation

## ✅ Implementation Complete

This document describes the comprehensive request throttling system for rate limiting and abuse prevention.

---

## 📋 Overview

The request throttling system provides multiple throttling strategies, flexible configuration, and comprehensive monitoring to protect the API from abuse and ensure fair resource usage.

### Key Features
- **Multiple strategies** - Sliding window, token bucket, leaky bucket, fixed window
- **Flexible scoping** - Per user, IP, endpoint, or combinations
- **Dynamic rules** - Create and manage rules via API
- **Comprehensive logging** - Track all throttling events
- **Statistics and monitoring** - View throttling analytics
- **IP whitelist/blacklist** - Manage IP access
- **Priority-based rules** - Apply multiple rules with priority

---

## 🏗️ Architecture

### Components

1. **Throttling Service** (`api/src/services/throttling.service.ts`)
   - Core throttling logic
   - Multiple strategy implementations
   - Cache management
   - Statistics

2. **Throttle Rule Model** (`api/src/models/ThrottleRule.ts`)
   - Rule configuration
   - Targeting options
   - Status management

3. **Throttle Log Model** (`api/src/models/ThrottleLog.ts`)
   - Event logging
   - Analytics data
   - Auto-cleanup (90 days)

4. **Throttling Middleware** (`api/src/middleware/throttling.middleware.ts`)
   - Route protection
   - Rule application
   - Response headers

5. **Throttling Controller** (`api/src/controllers/throttling.controller.ts`)
   - Rule management
   - Statistics viewing
   - Log viewing

---

## 📦 Implementation Details

### 1. Throttling Strategies

#### Sliding Window (Default)
**Best for**: General rate limiting, smooth distribution

```typescript
{
  strategy: 'sliding-window',
  maxRequests: 100,
  windowMs: 60000, // 1 minute
}
```

**How it works**: Tracks requests in a sliding time window. Window resets when expired.

#### Token Bucket
**Best for**: Allowing bursts, then steady rate

```typescript
{
  strategy: 'token-bucket',
  maxRequests: 100, // Refill rate
  windowMs: 60000,
  bucketSize: 200, // Allow bursts up to 200
  refillRate: 100, // Refill at 100 requests per minute
}
```

**How it works**: Tokens are consumed per request. Tokens refill at constant rate. Allows bursts up to bucket size.

#### Leaky Bucket
**Best for**: Smooth, consistent rate limiting

```typescript
{
  strategy: 'leaky-bucket',
  maxRequests: 100,
  windowMs: 60000,
  refillRate: 100, // Requests per minute
}
```

**How it works**: Requests leak out at constant rate. No bursts allowed.

#### Fixed Window
**Best for**: Simple time-based limits

```typescript
{
  strategy: 'fixed-window',
  maxRequests: 100,
  windowMs: 60000,
}
```

**How it works**: Fixed time windows. Resets at window boundary.

---

### 2. Throttling Scopes

#### Global
Throttle all requests globally.

```typescript
{
  scope: 'global',
  identifier: 'global',
}
```

#### Per User
Throttle per authenticated user.

```typescript
{
  scope: 'user',
  identifier: 'user_id',
}
```

#### Per IP
Throttle per IP address.

```typescript
{
  scope: 'ip',
  identifier: '192.168.1.1',
}
```

#### Per Endpoint
Throttle per API endpoint.

```typescript
{
  scope: 'endpoint',
  identifier: 'POST /api/products',
}
```

#### Per User + Endpoint
Throttle combination of user and endpoint.

```typescript
{
  scope: 'user-endpoint',
  identifier: 'user_id:POST /api/products',
}
```

#### Per IP + Endpoint
Throttle combination of IP and endpoint.

```typescript
{
  scope: 'ip-endpoint',
  identifier: '192.168.1.1:POST /api/products',
}
```

---

### 3. Usage Examples

#### Basic Throttling Middleware

```typescript
import { throttleMiddleware } from '../middleware/throttling.middleware';

// Apply to route
router.post(
  '/api/products',
  throttleMiddleware({
    strategy: 'sliding-window',
    scope: 'ip',
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  }),
  createProduct
);
```

#### Using Throttle Rule

```typescript
import { throttleRuleMiddleware } from '../middleware/throttling.middleware';

// Apply rule by ID
router.post(
  '/api/orders',
  throttleRuleMiddleware('rule_id_here'),
  createOrder
);
```

#### Auto Throttling (Multiple Rules)

```typescript
import { throttleAutoMiddleware } from '../middleware/throttling.middleware';

// Automatically applies matching rules
router.use('/api', throttleAutoMiddleware());
```

#### Programmatic Check

```typescript
import { checkThrottle } from '../services/throttling.service';

const result = await checkThrottle(req, {
  strategy: 'token-bucket',
  scope: 'user',
  maxRequests: 50,
  windowMs: 60000,
  bucketSize: 100,
  refillRate: 50,
});

if (!result.allowed) {
  return res.status(429).json({
    error: 'Rate limit exceeded',
    retryAfter: result.retryAfter,
  });
}
```

---

### 4. API Endpoints

**Base URL**: `/api/admin/throttling`

#### POST `/api/admin/throttling/rules`
Create a new throttling rule.

**Request Body**:
```json
{
  "name": "API Rate Limit",
  "description": "Limit API requests per IP",
  "strategy": "sliding-window",
  "scope": "ip",
  "maxRequests": 100,
  "windowMs": 60000,
  "active": true,
  "priority": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule_id",
      "name": "API Rate Limit",
      "strategy": "sliding-window",
      "scope": "ip",
      "maxRequests": 100,
      "windowMs": 60000,
      "active": true
    }
  }
}
```

#### GET `/api/admin/throttling/rules`
List all throttling rules.

**Query Parameters**:
- `active` (optional): Filter by active status
- `page` (optional): Page number
- `limit` (optional): Results per page

#### GET `/api/admin/throttling/rules/:ruleId`
Get rule details.

#### PUT `/api/admin/throttling/rules/:ruleId`
Update rule.

#### DELETE `/api/admin/throttling/rules/:ruleId`
Delete rule.

#### GET `/api/admin/throttling/stats`
Get throttling statistics.

**Query Parameters**:
- `ruleId` (optional): Filter by rule
- `startDate` (optional): Start date
- `endDate` (optional): End date

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 10000,
      "allowed": 9500,
      "blocked": 500,
      "blockRate": 5.0,
      "byScope": {
        "ip": 8000,
        "user": 2000
      },
      "byEndpoint": {
        "POST /api/products": 3000,
        "GET /api/products": 7000
      }
    }
  }
}
```

#### GET `/api/admin/throttling/logs`
Get throttling logs.

**Query Parameters**:
- `ruleId` (optional): Filter by rule
- `allowed` (optional): Filter by allowed/blocked
- `scope` (optional): Filter by scope
- `identifier` (optional): Filter by identifier
- `ipAddress` (optional): Filter by IP
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `page` (optional): Page number
- `limit` (optional): Results per page

---

### 5. Response Headers

Throttling middleware sets the following headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retry (when blocked)

**Example**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705320000
Retry-After: 15
```

---

### 6. Rule Configuration

#### Basic Rule

```typescript
{
  name: "API Rate Limit",
  strategy: "sliding-window",
  scope: "ip",
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  active: true,
  priority: 0,
}
```

#### Rule with Endpoint Pattern

```typescript
{
  name: "Product Creation Limit",
  strategy: "token-bucket",
  scope: "user-endpoint",
  maxRequests: 10,
  windowMs: 60000,
  bucketSize: 20,
  endpointPattern: "^POST /api/products",
  active: true,
  priority: 10,
}
```

#### Rule with User Role Filter

```typescript
{
  name: "Reseller API Limit",
  strategy: "sliding-window",
  scope: "user",
  maxRequests: 500,
  windowMs: 60000,
  userRoles: ["reseller"],
  active: true,
  priority: 5,
}
```

#### Rule with IP Management

```typescript
{
  name: "Strict IP Limit",
  strategy: "leaky-bucket",
  scope: "ip",
  maxRequests: 50,
  windowMs: 60000,
  ipWhitelist: ["192.168.1.1", "10.0.0.1"], // Exclude from throttling
  ipBlacklist: ["192.168.1.100"], // Always throttle
  blockDuration: 3600000, // Block for 1 hour if limit exceeded
  active: true,
  priority: 20,
}
```

---

## 🚀 Best Practices

### 1. Choose the Right Strategy

- **Sliding Window**: General purpose, smooth distribution
- **Token Bucket**: When bursts are acceptable
- **Leaky Bucket**: When consistent rate is required
- **Fixed Window**: Simple time-based limits

### 2. Set Appropriate Limits

- **Public APIs**: 100-1000 requests per minute per IP
- **Authenticated APIs**: 500-5000 requests per minute per user
- **Sensitive endpoints**: 5-10 requests per minute
- **File uploads**: 10-50 requests per hour

### 3. Use Priority Wisely

- Higher priority rules are checked first
- Use priority to create rule hierarchies
- Most restrictive rules should have highest priority

### 4. Monitor and Adjust

- Review throttling statistics regularly
- Adjust limits based on usage patterns
- Monitor block rates
- Identify abuse patterns

### 5. IP Management

- Whitelist trusted IPs (internal services, CDNs)
- Blacklist known bad actors
- Use IP ranges for whitelisting

---

## 📊 Performance Considerations

### Memory Usage

- In-memory cache for throttling state
- Consider Redis for distributed systems
- Cache cleanup runs every 5 minutes

### Database Load

- Throttle logs are written asynchronously
- Logs auto-delete after 90 days
- Statistics queries are optimized with indexes

### Scalability

- For high-traffic systems, use Redis instead of in-memory cache
- Consider distributed rate limiting
- Use CDN-level rate limiting for DDoS protection

---

## 🔍 Troubleshooting

### Issue: Too many false positives

**Solution**: Adjust limits or switch strategy
```typescript
// Increase limit
maxRequests: 200, // Instead of 100

// Or use token bucket for bursts
strategy: 'token-bucket',
bucketSize: 200,
```

### Issue: Not throttling enough

**Solution**: Lower limits or add blocking
```typescript
maxRequests: 50, // Lower limit
blockDuration: 3600000, // Block for 1 hour
```

### Issue: Performance impact

**Solution**: Use Redis or optimize cache
```typescript
// In production, replace in-memory cache with Redis
// See throttling.service.ts for cache implementation
```

---

## ✅ Checklist

- [x] Multiple throttling strategies
- [x] Flexible scoping (user, IP, endpoint, combinations)
- [x] Dynamic rule management
- [x] Throttling middleware
- [x] Rule-based throttling
- [x] Auto-throttling with multiple rules
- [x] IP whitelist/blacklist
- [x] User role filtering
- [x] Endpoint pattern matching
- [x] Comprehensive logging
- [x] Statistics and analytics
- [x] Admin management API
- [x] Response headers
- [x] Cache management
- [x] Documentation

---

## 🔧 Configuration

### Environment Variables

No specific environment variables required. Throttling rules are managed via API.

### Redis Integration (Optional)

For production with multiple servers, replace in-memory cache with Redis:

```typescript
// In throttling.service.ts, replace Map with Redis client
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
```

---

**Status**: ✅ Complete and Ready for Production

**Last Updated**: 2024-01-15

