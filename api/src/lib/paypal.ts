import paypal from '@paypal/checkout-server-sdk';

/**
 * PayPal Client Initialization
 * 
 * PURPOSE:
 * - Initialize PayPal client for server-side operations
 * - Support sandbox and live environments
 * - Centralized configuration
 */

if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
  console.warn('PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
}

const environment = process.env.PAYPAL_ENV === 'live' 
  ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_CLIENT_SECRET!)
  : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_CLIENT_SECRET!);

export const paypalClient = new paypal.core.PayPalHttpClient(environment);

export default paypalClient;

