# Complete Abandoned Cart Recovery System - Client-Ready Explanation

## 🎯 Executive Summary

This document provides a comprehensive overview of the complete abandoned cart recovery system, including both **Email** and **WhatsApp** recovery automation. The system automatically detects abandoned carts, sends timed recovery messages through multiple channels, and tracks conversions with full compliance and analytics.

**Built for**: Multi-tenant marketplace with suppliers, resellers, and customers  
**Scale**: Production-ready, enterprise-grade  
**Philosophy**: Policy-driven, opt-in based, compliant, auditable, conversion-optimized

---

## 🔄 Complete Recovery Journey

```
┌─────────────────────────────────────────────────────────────┐
│              ABANDONED CART RECOVERY LIFECYCLE              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CART ABANDONED → DETECTION → CHANNEL SELECTION            │
│         ↓              ↓              ↓                      │
│    Inactive      Every 15 min    Email / WhatsApp          │
│                                                             │
│  RECOVERY SCHEDULED → TIMED MESSAGES → RECOVERY LINK       │
│         ↓                    ↓              ↓               │
│    Token Generated    1hr, 24hr, 72hr   Secure Token       │
│                                                             │
│  CART RECOVERED → CONVERSION → REVENUE TRACKED             │
│         ↓              ↓              ↓                     │
│    User Clicks    Order Created   Metrics Updated          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📧 Phase 1: Email Recovery System

### Step 1: Abandonment Detection
**System**: Abandoned Cart Detector Job
- **Frequency**: Runs every 15 minutes
- **Threshold**: 30 minutes of inactivity (configurable per store)
- **Criteria**:
  - Cart status = `active`
  - `lastUpdatedAt` < now - threshold
  - Cart has items
  - Cart has email (guest) or userId (authenticated)
- **Action**: Marks cart as `abandoned`, emits `CART_ABANDONED` event

### Step 2: Email Scheduling
**System**: Cart Recovery Scheduler
- **Trigger**: `CART_ABANDONED` event
- **Checks**:
  - Store recovery enabled
  - User not opted out
  - Cart still abandoned
- **Schedule**: 
  - Email 1: After 1 hour
  - Email 2: After 24 hours
  - Email 3: After 72 hours (with optional incentive)
- **Token**: Generates secure recovery token (7-day expiry)

### Step 3: Email Content
**System**: Cart Recovery Mailer
- **Includes**:
  - Store branding (logo, colors)
  - Cart items (name, image, price, quantity)
  - Total estimate
  - Recovery CTA button
  - Unsubscribe link
- **Templates**: Professional HTML, responsive design
- **Personalization**: Store name, item count, recovery link

### Step 4: Recovery Link
**System**: Cart Recovery Controller
- **Endpoint**: `GET /api/cart/recover?token=XXXX`
- **Security**:
  - Token validation (hashed)
  - Expiry checking
  - Single-use enforcement
  - Rate limiting (5 requests per 15 minutes)
- **Action**: Restores cart to active, redirects to checkout

### Step 5: Conversion Tracking
**System**: Order Creation Service
- **On Order Creation**:
  - Marks cart as `converted`
  - Cancels pending recovery emails
  - Updates metrics with revenue
  - Emits `CART_CONVERTED` event

---

## 📱 Phase 2: WhatsApp Recovery System

### Step 1: Abandonment Detection
**System**: Same as Email (Abandoned Cart Detector)
- Detects abandoned carts
- Emits `CART_ABANDONED` event

### Step 2: WhatsApp Scheduling
**System**: WhatsApp Recovery Scheduler
- **Trigger**: `CART_ABANDONED` event
- **Checks**:
  - User has `whatsappOptIn = true`
  - Phone number available
  - Store WhatsApp recovery enabled
  - Cart still abandoned
- **Schedule**:
  - Message 1: After 1 hour
  - Message 2: After 24 hours
  - Message 3: After 72 hours
- **Quiet Hours**: Respects 10 PM - 8 AM (configurable)
- **Rate Limit**: Max 1 WhatsApp per cart per 24h

### Step 3: Message Dispatch
**System**: WhatsApp Recovery Sender Job
- **Frequency**: Runs every minute
- **Process**:
  - Picks due messages
  - Validates cart status
  - Sends via WhatsApp provider (Twilio/Meta BSP)
  - Updates delivery status
  - Retries on failure (exponential backoff)
- **Templates**: Pre-approved WhatsApp Business templates only

### Step 4: WhatsApp Provider
**System**: WhatsApp Provider Abstraction
- **Twilio** (Initial):
  - Template-based messaging
  - Delivery status tracking
  - Error handling
- **Meta BSP** (Future):
  - Ready for integration
  - Same interface
- **Compliance**: Templates only, no free-text

### Step 5: Opt-Out Handling
**System**: WhatsApp Webhook Controller
- **Endpoint**: `POST /webhooks/whatsapp/inbound`
- **Commands**:
  - `STOP` / `UNSUBSCRIBE` → Opts out, cancels messages
  - `START` / `SUBSCRIBE` → Opts in
- **Action**: Updates user `whatsappOptIn` status immediately

### Step 6: Recovery Link
**System**: Same recovery endpoint as Email
- Uses same secure token system
- Tracks WhatsApp clicks separately
- Updates WhatsApp metrics

### Step 7: Conversion Tracking
**System**: Order Creation Service
- **On Order Creation**:
  - Marks cart as `converted`
  - Cancels pending WhatsApp messages
  - Updates WhatsApp metrics with revenue
  - Emits `CART_RECOVERED_WHATSAPP` event

---

## 🔐 Safety & Compliance

### Email Recovery
- ✅ **Opt-Out Support**: Unsubscribe link in every email
- ✅ **No Guest Emails**: Only sends if email provided
- ✅ **No Duplicates**: One active token per cart
- ✅ **Rate Limited**: Recovery endpoint rate-limited
- ✅ **GDPR Compliant**: Permanent opt-out tracking

### WhatsApp Recovery
- ✅ **Opt-In Required**: Only sends if `whatsappOptIn = true`
- ✅ **Templates Only**: No free-text messages (WhatsApp policy)
- ✅ **Quiet Hours**: Respects 10 PM - 8 AM (configurable)
- ✅ **Rate Limited**: Max 1 message per cart per 24h
- ✅ **Immediate Opt-Out**: STOP command processed instantly
- ✅ **Delivery Tracking**: Full status updates via webhook

### Both Channels
- ✅ **No Messages After Conversion**: Cancels on order creation
- ✅ **Token Expiry**: 7-day expiry enforced
- ✅ **Single-Use Tokens**: Marked used after recovery
- ✅ **Store-Level Control**: Enable/disable per store
- ✅ **Complete Audit Trail**: All actions logged

---

## 📊 Analytics & Metrics

### Email Metrics
**Model**: `CartRecoveryMetrics`
- Emails sent
- Open rate (ready for pixel tracking)
- Click rate
- Recovery rate
- Conversion rate
- Revenue recovered

### WhatsApp Metrics
**Model**: `WhatsAppRecoveryMetrics`
- Messages sent
- Delivery rate
- Click rate (recovery link)
- Recovery rate
- Conversion rate
- Revenue recovered

### Aggregate Analytics
**Endpoint**: `GET /api/cart/recovery/metrics` (admin only)
- Total sent (email + WhatsApp)
- Channel comparison
- Conversion attribution
- Revenue attribution
- ROI calculation

---

## 🎯 Business Value

### For Customers
- ✅ **Convenient Recovery**: Multiple channels (email + WhatsApp)
- ✅ **Timely Reminders**: Don't miss abandoned purchases
- ✅ **Easy Opt-Out**: One-click unsubscribe
- ✅ **Secure Links**: Token-based recovery

### For Stores
- ✅ **Higher Conversion**: Multi-channel recovery increases recovery rate
- ✅ **Automated**: No manual intervention needed
- ✅ **Compliant**: Full opt-in/opt-out compliance
- ✅ **Analytics**: Complete performance tracking
- ✅ **Configurable**: Store-level settings

### For Platform
- ✅ **Revenue Recovery**: Recover lost sales from abandoned carts
- ✅ **Compliance**: WhatsApp Business Policy compliant
- ✅ **Scalable**: Handles high volume automatically
- ✅ **Auditable**: Complete audit trail
- ✅ **Multi-Channel**: Email + WhatsApp coverage

---

## 🔧 Technical Architecture

### Models
1. **Cart** - Tracks cart state (active/abandoned/converted)
2. **CartRecoveryToken** - Secure recovery tokens
3. **CartRecoveryMetrics** - Email recovery analytics
4. **CartRecoveryUnsubscribe** - Email opt-out tracking
5. **WhatsAppMessageLog** - WhatsApp message tracking
6. **WhatsAppRecoveryMetrics** - WhatsApp recovery analytics
7. **User** - WhatsApp opt-in status

### Services
1. **cartRecoveryScheduler** - Email scheduling
2. **cartRecoveryMailer** - Email content builder
3. **cartRecoveryWhatsAppScheduler** - WhatsApp scheduling
4. **whatsappProvider** - Provider abstraction (Twilio/Meta BSP)
5. **orderCreation.service** - Conversion handling

### Jobs
1. **abandonedCartDetector** - Detects abandoned carts (every 15 min)
2. **whatsappRecoverySender** - Sends WhatsApp messages (every 1 min)

### Controllers
1. **cartRecovery.controller** - Recovery endpoint
2. **whatsappWebhook.controller** - Opt-out & status webhooks

### Event Listeners
1. **cartRecovery.listener** - Listens for `CART_ABANDONED`, schedules recovery

---

## 📈 Recovery Flow Comparison

### Email Recovery
```
Cart Abandoned
  ↓
Email Scheduled (1hr, 24hr, 72hr)
  ↓
Email Sent
  ↓
User Clicks Link
  ↓
Cart Recovered
  ↓
Order Created → Conversion Tracked
```

### WhatsApp Recovery
```
Cart Abandoned
  ↓
WhatsApp Scheduled (1hr, 24hr, 72hr)
  ↓
Message Sent (via Twilio/Meta BSP)
  ↓
User Clicks Link
  ↓
Cart Recovered
  ↓
Order Created → Conversion Tracked
```

### Combined Recovery
```
Cart Abandoned
  ↓
Both Email & WhatsApp Scheduled
  ↓
User Receives Both (if opted in)
  ↓
User Clicks Either Link
  ↓
Cart Recovered
  ↓
Order Created → Both Channels Tracked
```

---

## 🚀 Key Features

### Multi-Channel Recovery
- ✅ **Email**: Professional HTML emails with cart items
- ✅ **WhatsApp**: Template-based messages via approved templates
- ✅ **Unified**: Same recovery token works for both channels
- ✅ **Coordinated**: Both channels scheduled simultaneously

### Intelligent Scheduling
- ✅ **Timed Sequence**: 1hr, 24hr, 72hr delays
- ✅ **Quiet Hours**: WhatsApp respects quiet hours (10 PM - 8 AM)
- ✅ **Store Config**: Per-store schedule configuration
- ✅ **Max Attempts**: Configurable max messages (default: 3)

### Compliance & Safety
- ✅ **Opt-In Required**: WhatsApp requires explicit opt-in
- ✅ **Opt-Out Supported**: Both channels support unsubscribe
- ✅ **Templates Only**: WhatsApp uses approved templates only
- ✅ **Rate Limited**: Prevents spam and abuse
- ✅ **Token Security**: Hashed tokens, single-use, expiry

### Analytics & Tracking
- ✅ **Channel Attribution**: Track which channel recovered cart
- ✅ **Revenue Tracking**: Link recovery to order revenue
- ✅ **Conversion Rates**: Email vs WhatsApp performance
- ✅ **Delivery Status**: Track message delivery
- ✅ **Click Tracking**: Track recovery link clicks

---

## 📋 Configuration

### Store-Level Settings

**Email Recovery**:
```typescript
{
  cartRecovery: {
    enabled: true,
    maxAttempts: 3,
    emailSchedule: [
      { delayHours: 1, emailNumber: 1 },
      { delayHours: 24, emailNumber: 2 },
      { delayHours: 72, emailNumber: 3 }
    ]
  }
}
```

**WhatsApp Recovery**:
```typescript
{
  whatsappRecovery: {
    enabled: true,
    maxAttempts: 3,
    messageSchedule: [
      { delayHours: 1, messageType: 'abandoned_cart_1' },
      { delayHours: 24, messageType: 'abandoned_cart_2' },
      { delayHours: 72, messageType: 'abandoned_cart_3' }
    ],
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 8     // 8 AM
  }
}
```

### Environment Variables

**Email**:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**WhatsApp (Twilio)**:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_PROVIDER=twilio
```

---

## 🔗 Integration Points

### With Cart System
- Cart model tracks status (active/abandoned/converted)
- `lastUpdatedAt` tracks inactivity
- Cart items preserved for recovery

### With Order System
- Order creation marks cart as converted
- Cancels pending recovery messages
- Updates metrics with revenue

### With Event System
- Listens for `CART_ABANDONED` events
- Emits `CART_RECOVERED` and `CART_CONVERTED` events
- Tracks channel attribution

### With User System
- User model tracks WhatsApp opt-in
- Opt-out handled via webhook
- Email preferences tracked

---

## 📊 Performance Metrics

### Email Recovery
- **Open Rate**: Tracked (pixel ready)
- **Click Rate**: Tracked
- **Recovery Rate**: % of sent emails that recover cart
- **Conversion Rate**: % of recovered carts that convert
- **Revenue**: Total revenue from email-recovered carts

### WhatsApp Recovery
- **Delivery Rate**: Tracked via webhook
- **Click Rate**: Tracked (recovery link clicks)
- **Recovery Rate**: % of sent messages that recover cart
- **Conversion Rate**: % of recovered carts that convert
- **Revenue**: Total revenue from WhatsApp-recovered carts

### Combined Performance
- **Total Recovery Rate**: Combined email + WhatsApp
- **Channel Comparison**: Email vs WhatsApp performance
- **ROI**: Revenue recovered vs cost of messages
- **Best Channel**: Which channel performs better per store

---

## 🎓 Summary

This abandoned cart recovery system provides:

✅ **Dual-Channel Recovery**: Email + WhatsApp for maximum reach  
✅ **Intelligent Scheduling**: Timed sequences with quiet hours  
✅ **Full Compliance**: Opt-in/opt-out, templates only, rate limiting  
✅ **Complete Analytics**: Channel attribution, conversion tracking, revenue tracking  
✅ **Production-Ready**: Error handling, retries, audit trails  
✅ **Store-Configurable**: Per-store settings and enable/disable  

**Key Innovations**:
- Multi-channel recovery (Email + WhatsApp)
- Unified recovery token system
- Complete channel attribution
- WhatsApp Business Policy compliant
- Intelligent quiet hours
- Full opt-in/opt-out compliance

**This is a best-in-class abandoned cart recovery system with dual-channel automation, full compliance, and comprehensive analytics, ready for production deployment.**

---

*Last Updated: 2024-01-15*  
*Version: 2.0.0*  
*Architecture: Multi-Channel, Opt-In Based, Compliant, Analytics-Driven*
