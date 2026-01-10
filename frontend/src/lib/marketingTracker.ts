/**
 * Marketing Tracker
 * 
 * PURPOSE:
 * - Capture UTM parameters and referrer on page load
 * - Persist attribution in cookie (30-90 days)
 * - Send tracking events to backend
 * - Do NOT overwrite existing attribution unless expired
 */

const ATTRIBUTION_COOKIE = 'mk_attribution';
const ATTRIBUTION_COOKIE_MAX_AGE = 90; // days
const SESSION_COOKIE = 'mk_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export interface AttributionData {
  sessionId: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrerDomain?: string;
  landingPage: string;
  firstTouchAt: string;
  lastTouchAt: string;
}

/**
 * Get or create session ID
 */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = getCookie(SESSION_COOKIE);
  const sessionData = sessionId ? JSON.parse(sessionId) : null;

  // Check if session expired
  if (sessionData && sessionData.expiresAt && new Date(sessionData.expiresAt) > new Date()) {
    return sessionData.sessionId;
  }

  // Create new session
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);
  setCookie(SESSION_COOKIE, JSON.stringify({ sessionId: newSessionId, expiresAt: expiresAt.toISOString() }), 1); // 1 day
  return newSessionId;
}

/**
 * Get cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Set cookie
 */
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Get URL parameters
 */
function getUrlParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Get referrer
 */
function getReferrer(): { url?: string; domain?: string } {
  if (typeof document === 'undefined') return {};
  return {
    url: document.referrer || undefined,
    domain: document.referrer ? extractDomain(document.referrer) : undefined,
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Check if attribution is expired
 */
function isAttributionExpired(attribution: AttributionData): boolean {
  const lastTouch = new Date(attribution.lastTouchAt);
  const daysSinceLastTouch = (Date.now() - lastTouch.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastTouch > ATTRIBUTION_COOKIE_MAX_AGE;
}

/**
 * Track marketing touch
 */
export async function trackMarketingTouch(storeId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const sessionId = getOrCreateSessionId();
    const urlParams = getUrlParams();
    const referrer = getReferrer();
    const landingPage = window.location.pathname + window.location.search;

    // Get existing attribution
    const existingAttributionCookie = getCookie(ATTRIBUTION_COOKIE);
    let existingAttribution: AttributionData | null = null;

    if (existingAttributionCookie) {
      try {
        existingAttribution = JSON.parse(existingAttributionCookie);
        // Check if expired
        if (isAttributionExpired(existingAttribution!)) {
          existingAttribution = null;
        }
      } catch {
        existingAttribution = null;
      }
    }

    // Determine if we should update attribution
    const hasUTMParams = urlParams.utm_source || urlParams.utm_medium;
    const hasNewReferrer = referrer.url && referrer.url !== existingAttribution?.referrerDomain;
    const shouldUpdate = hasUTMParams || (hasNewReferrer && !existingAttribution);

    if (!shouldUpdate && existingAttribution) {
      // Update last touch time only
      existingAttribution.lastTouchAt = new Date().toISOString();
      setCookie(ATTRIBUTION_COOKIE, JSON.stringify(existingAttribution), ATTRIBUTION_COOKIE_MAX_AGE);
      return;
    }

    // Create or update attribution
    const attribution: AttributionData = {
      sessionId,
      source: urlParams.utm_source,
      medium: urlParams.utm_medium,
      campaign: urlParams.utm_campaign,
      content: urlParams.utm_content,
      term: urlParams.utm_term,
      referrerDomain: referrer.domain,
      landingPage,
      firstTouchAt: existingAttribution?.firstTouchAt || new Date().toISOString(),
      lastTouchAt: new Date().toISOString(),
    };

    // Save to cookie
    setCookie(ATTRIBUTION_COOKIE, JSON.stringify(attribution), ATTRIBUTION_COOKIE_MAX_AGE);

    // Send to backend
    if (storeId) {
      await sendTrackingEvent(storeId, attribution, referrer.url);
    }
  } catch (error) {
    console.error('[MARKETING TRACKER] Error tracking marketing touch:', error);
  }
}

/**
 * Send tracking event to backend
 */
async function sendTrackingEvent(storeId: string, attribution: AttributionData, referrerUrl?: string): Promise<void> {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    await fetch(`${API_BASE_URL}/tracking/marketing-touch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        storeId,
        sessionId: attribution.sessionId,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content,
        term: attribution.term,
        landingPage: attribution.landingPage,
        referrerUrl,
        referrerDomain: attribution.referrerDomain,
      }),
    });
  } catch (error) {
    console.error('[MARKETING TRACKER] Error sending tracking event:', error);
  }
}

/**
 * Get current attribution
 */
export function getCurrentAttribution(): AttributionData | null {
  if (typeof window === 'undefined') return null;

  const cookie = getCookie(ATTRIBUTION_COOKIE);
  if (!cookie) return null;

  try {
    const attribution = JSON.parse(cookie);
    if (isAttributionExpired(attribution)) {
      return null;
    }
    return attribution;
  } catch {
    return null;
  }
}

/**
 * Initialize tracking (call on app load)
 */
export function initializeMarketingTracking(storeId?: string): void {
  if (typeof window === 'undefined') return;

  // Track on page load
  trackMarketingTouch(storeId);

  // Track on navigation (for SPA)
  if (typeof window !== 'undefined' && window.history) {
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      trackMarketingTouch(storeId);
    };

    window.addEventListener('popstate', () => {
      trackMarketingTouch(storeId);
    });
  }
}

