import mongoose from 'mongoose';
import { MarketingTouch } from '../models/MarketingTouch';
import { AttributionSession } from '../models/AttributionSession';
import { MarketingChannel } from '../models/MarketingTouch';
import { AttributionModel } from '../models/AttributionSnapshot';

/**
 * Attribution Engine
 * 
 * PURPOSE:
 * - Resolve marketing channel from UTM parameters and referrer
 * - Calculate attribution based on different models
 * - Support first-touch, last-touch, linear, and time-decay
 */

export interface AttributionResult {
  channel: MarketingChannel;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrerDomain?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ChannelCredits {
  channel: MarketingChannel;
  credit: number; // 0-1, represents share of attribution
  touchId: mongoose.Types.ObjectId;
  occurredAt: Date;
}

/**
 * Resolve marketing channel from UTM parameters and referrer
 */
export function resolveChannel(params: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerUrl?: string;
  referrerDomain?: string;
}): AttributionResult {
  const { utmSource, utmMedium, utmCampaign, referrerUrl, referrerDomain } = params;

  // High confidence: UTM parameters present
  if (utmSource && utmMedium) {
    const source = utmSource.toLowerCase();
    const medium = utmMedium.toLowerCase();

    // Paid search
    if (medium === 'cpc' || medium === 'ppc' || source.includes('google') || source.includes('bing')) {
      return {
        channel: 'paid_search',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Paid social
    if (medium === 'social' && (source.includes('facebook') || source.includes('instagram') || source.includes('linkedin'))) {
      return {
        channel: 'paid_social',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Organic social
    if (medium === 'social') {
      return {
        channel: 'social',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Email
    if (medium === 'email') {
      return {
        channel: 'email',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // WhatsApp
    if (medium === 'whatsapp' || source.includes('whatsapp')) {
      return {
        channel: 'whatsapp',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // SMS
    if (medium === 'sms') {
      return {
        channel: 'sms',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Referral
    if (medium === 'referral') {
      return {
        channel: 'referral',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Affiliate
    if (medium === 'affiliate' || source.includes('affiliate')) {
      return {
        channel: 'affiliate',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Influencer
    if (medium === 'influencer' || source.includes('influencer')) {
      return {
        channel: 'influencer',
        source: utmSource,
        medium: utmMedium,
        campaign: utmCampaign,
        confidence: 'high',
      };
    }

    // Default: use source as channel indicator
    return {
      channel: 'unknown',
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      confidence: 'medium',
    };
  }

  // Medium confidence: Referrer analysis
  if (referrerDomain) {
    const domain = referrerDomain.toLowerCase();

    // Search engines
    if (domain.includes('google') || domain.includes('bing') || domain.includes('yahoo') || domain.includes('duckduckgo')) {
      return {
        channel: 'organic_search',
        source: referrerDomain,
        referrerDomain,
        confidence: 'medium',
      };
    }

    // Social media
    if (
      domain.includes('facebook') ||
      domain.includes('twitter') ||
      domain.includes('instagram') ||
      domain.includes('linkedin') ||
      domain.includes('pinterest')
    ) {
      return {
        channel: 'social',
        source: referrerDomain,
        referrerDomain,
        confidence: 'medium',
      };
    }

    // Referral (other websites)
    return {
      channel: 'referral',
      source: referrerDomain,
      referrerDomain,
      confidence: 'medium',
    };
  }

  // Low confidence: Direct or unknown
  if (!referrerUrl || referrerUrl === '') {
    return {
      channel: 'direct',
      confidence: 'low',
    };
  }

  return {
    channel: 'unknown',
    confidence: 'low',
  };
}

/**
 * Calculate attribution credits for a session based on model
 */
export async function calculateAttribution(
  sessionId: string,
  model: AttributionModel
): Promise<ChannelCredits[]> {
  const session = await AttributionSession.findOne({ sessionId })
    .populate('allTouchIds')
    .lean();

  if (!session || !session.allTouchIds || session.allTouchIds.length === 0) {
    return [];
  }

  const touches = session.allTouchIds as any[];
  if (touches.length === 0) {
    return [];
  }

  // Sort touches by occurredAt
  touches.sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return aTime - bTime;
  });

  switch (model) {
    case 'first_touch':
      // 100% credit to first touch
      return [
        {
          channel: touches[0].channel,
          credit: 1.0,
          touchId: touches[0]._id,
          occurredAt: touches[0].occurredAt,
        },
      ];

    case 'last_touch':
      // 100% credit to last touch
      const lastTouch = touches[touches.length - 1];
      return [
        {
          channel: lastTouch.channel,
          credit: 1.0,
          touchId: lastTouch._id,
          occurredAt: lastTouch.occurredAt,
        },
      ];

    case 'linear':
      // Equal credit to all touches
      const creditPerTouch = 1.0 / touches.length;
      return touches.map((touch) => ({
        channel: touch.channel,
        credit: creditPerTouch,
        touchId: touch._id,
        occurredAt: touch.occurredAt,
      }));

    case 'time_decay':
      // Recent touches get more credit (exponential decay)
      const now = Date.now();
      const totalWeight = touches.reduce((sum, touch) => {
        const touchTime = touch.occurredAt ? new Date(touch.occurredAt).getTime() : now;
        const ageHours = (now - touchTime) / (1000 * 60 * 60);
        return sum + Math.exp(-ageHours / 24); // 24-hour half-life
      }, 0);

      return touches.map((touch) => {
        const touchTime = touch.occurredAt ? new Date(touch.occurredAt).getTime() : now;
        const ageHours = (now - touchTime) / (1000 * 60 * 60);
        const weight = Math.exp(-ageHours / 24);
        return {
          channel: touch.channel,
          credit: weight / totalWeight,
          touchId: touch._id,
          occurredAt: touch.occurredAt,
        };
      });

    default:
      return [];
  }
}

/**
 * Extract referrer domain from URL
 */
export function extractReferrerDomain(referrerUrl?: string): string | undefined {
  if (!referrerUrl) return undefined;

  try {
    const url = new URL(referrerUrl);
    return url.hostname.replace('www.', '');
  } catch {
    return undefined;
  }
}

/**
 * Detect bot traffic (basic heuristics)
 */
export function isBotTraffic(userAgent?: string): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /googlebot/i,
    /bingbot/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent));
}

