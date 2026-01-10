/**
 * Funnel Tracker (session-based)
 *
 * PURPOSE:
 * - Emit session-scoped funnel events to backend for conversion analytics.
 * - Works for guests and logged-in users.
 *
 * Events:
 * - PAGE_VIEW
 * - PRODUCT_VIEW
 * - ADD_TO_CART
 * - CHECKOUT_STARTED
 * - PAYMENT_SUCCESS
 *
 * Notes:
 * - Reuses marketing session cookie (mk_session) when available.
 * - Includes optional filters in payload: device + source.
 */

type FunnelEventType =
  | 'PAGE_VIEW'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'CHECKOUT_STARTED'
  | 'PAYMENT_SUCCESS';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  // Prefer marketing session cookie if present
  const mkSession = getCookie('mk_session');
  if (mkSession) {
    try {
      const parsed = JSON.parse(mkSession);
      if (parsed?.sessionId) return String(parsed.sessionId);
    } catch {
      // ignore
    }
  }

  // Fallback: localStorage session
  const key = 'funnel_session_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function detectDevice(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

function detectSource(): string | undefined {
  // Prefer marketing attribution cookie if present
  const mkAttr = getCookie('mk_attribution');
  if (mkAttr) {
    try {
      const parsed = JSON.parse(mkAttr);
      if (parsed?.source) return String(parsed.source);
      if (parsed?.referrerDomain) return String(parsed.referrerDomain);
    } catch {
      // ignore
    }
  }
  // Fallback: referrer domain
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      return new URL(document.referrer).hostname.replace('www.', '');
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function trackFunnelEvent(eventType: FunnelEventType, options?: {
  entityId?: string;
  pagePath?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const sessionId = getSessionId();
  const device = detectDevice();
  const source = detectSource();

  // If you have storeId in localStorage, attach it (used by backend resolveStoreOptional)
  const storeId = window.localStorage.getItem('storeId') || undefined;

  try {
    await fetch(`${API_BASE_URL}/analytics/conversion/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      // no credentials required; keep it simple and CSRF-free
      keepalive: true,
      body: JSON.stringify({
        sessionId,
        eventType,
        entityId: options?.entityId,
        occurredAt: new Date().toISOString(),
        device,
        source,
        pagePath: options?.pagePath ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
        metadata: options?.metadata,
      }),
    });
  } catch {
    // Never break UX on analytics logging
  }
}

/**
 * Initializes automatic PAGE_VIEW tracking on SPA navigation.
 */
export function initializeFunnelTracking(): void {
  if (typeof window === 'undefined') return;

  // Track initial page view
  trackFunnelEvent('PAGE_VIEW').catch(() => {});

  // Track subsequent navigations
  if (window.history) {
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args as any);
      trackFunnelEvent('PAGE_VIEW').catch(() => {});
    };
    window.addEventListener('popstate', () => {
      trackFunnelEvent('PAGE_VIEW').catch(() => {});
    });
  }
}


