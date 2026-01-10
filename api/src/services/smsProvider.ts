/**
 * SMS Provider Abstraction
 *
 * PURPOSE:
 * - Abstract SMS messaging provider
 * - Support Twilio (initial), MSG91, AWS SNS (future)
 * - Plain text messaging
 * - Consistent interface across providers
 *
 * RULES:
 * - Plain text messages only
 * - E.164 phone number format
 * - Idempotent sending
 */

// Twilio import - optional, will fail gracefully if not installed
let twilio: any;
try {
  twilio = require('twilio');
} catch (error) {
  console.warn('[SMS PROVIDER] Twilio package not installed. Install with: npm install twilio');
}

export interface SendSMSParams {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  message: string; // Plain text message
}

export interface SendSMSResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface ISMSProvider {
  sendSMS(params: SendSMSParams): Promise<SendSMSResult>;
}

/**
 * Twilio SMS Provider Implementation
 */
class TwilioSMSProvider implements ISMSProvider {
  private client: any; // twilio.Twilio
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER || '';

    if (!twilio) {
      console.warn('[SMS PROVIDER] Twilio package not installed');
      this.client = null;
    } else if (!accountSid || !authToken) {
      console.warn('[SMS PROVIDER] Twilio credentials not configured');
      this.client = null;
    } else if (!this.fromNumber) {
      console.warn('[SMS PROVIDER] TWILIO_SMS_FROM or TWILIO_PHONE_NUMBER not configured');
      this.client = null;
    } else {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM');
      }

      const { to, message } = params;

      // Format phone number (ensure E.164 format)
      const formattedTo = this.formatPhoneNumber(to);

      // Send via Twilio SMS
      const twilioMessage = await this.client.messages.create({
        from: this.fromNumber,
        to: formattedTo,
        body: message,
      });

      return {
        success: true,
        providerMessageId: twilioMessage.sid,
      };
    } catch (error: any) {
      console.error('[SMS PROVIDER] Twilio error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS',
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If doesn't start with +, assume it needs country code
    if (!cleaned.startsWith('+')) {
      // Default to +91 (India) if no country code - adjust based on your market
      const defaultCountryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || '91';
      cleaned = `+${defaultCountryCode}${cleaned}`;
    }

    return cleaned;
  }
}

/**
 * MSG91 SMS Provider Implementation (Future)
 */
class MSG91SMSProvider implements ISMSProvider {
  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    // TODO: Implement MSG91 provider
    // This would use MSG91's SMS API
    throw new Error('MSG91 SMS provider not yet implemented');
  }
}

/**
 * AWS SNS SMS Provider Implementation (Future)
 */
class AWSSNSSMSProvider implements ISMSProvider {
  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    // TODO: Implement AWS SNS provider
    // This would use AWS SNS for SMS
    throw new Error('AWS SNS SMS provider not yet implemented');
  }
}

/**
 * SMS Provider Factory
 */
export class SMSProvider implements ISMSProvider {
  private provider: ISMSProvider;

  constructor(providerType: 'twilio' | 'msg91' | 'aws_sns' = 'twilio') {
    switch (providerType) {
      case 'twilio':
        this.provider = new TwilioSMSProvider();
        break;
      case 'msg91':
        this.provider = new MSG91SMSProvider();
        break;
      case 'aws_sns':
        this.provider = new AWSSNSSMSProvider();
        break;
      default:
        this.provider = new TwilioSMSProvider();
    }
  }

  async sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
    return this.provider.sendSMS(params);
  }
}

/**
 * Default provider instance
 */
export const smsProvider: ISMSProvider = new SMSProvider(
  (process.env.SMS_PROVIDER as 'twilio' | 'msg91' | 'aws_sns') || 'twilio'
);

