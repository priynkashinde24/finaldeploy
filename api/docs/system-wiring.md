# System Wiring Map (Draft)

## Request Lifecycle
- Incoming request → `ipRestriction` → `attachRequestContext` → auth/resolveStore → business route → audit/security logging → response

## Pricing Flow
- Product/variant fetch → pricing rules (admin) → store overrides → dynamic pricing → promotions/coupons → final price

## Order Flow
- Checkout validation → idempotency check → transaction: create order + inventory checks + payouts snapshot → emit ORDER_CREATED event → async handlers (analytics/notifications)

## Payment Flow
- Payment intent → payment provider → webhook → idempotency check → transaction: mark payment success + order paid → emit PAYMENT_SUCCESS → inventory finalize/fulfillment

## Failure Handling
- Use transactions for multi-write operations
- Normalize errors via AppError (no stack leak)
- Security events logged on blocks/failures

## Rollback Logic
- Transactions ensure atomicity for order/payment/subscription updates
- Idempotency prevents duplicate side-effects on retries/webhooks


