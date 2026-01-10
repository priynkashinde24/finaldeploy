import Stripe from 'stripe';

/**
 * Stripe Initialization
 * 
 * PURPOSE:
 * - Initialize Stripe client once
 * - Use consistent API version
 * - Centralized configuration
 * 
 * NOTE: Lazy initialization - only throws error when Stripe is actually used
 */

let stripeInstance: Stripe | null = null;

/**
 * Get Stripe instance (lazy initialization)
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required. Please set it in your environment variables.');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16', // Stripe API version (YYYY-MM-DD format)
    });
  }
  return stripeInstance;
}

/**
 * Export stripe instance (for backward compatibility)
 * Throws error only when accessed, not at module load time
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

export default stripe;

