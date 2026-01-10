/**
 * WhatsApp Provider Abstraction
 *
 * PURPOSE:
 * - Abstract WhatsApp messaging provider
 * - Support Twilio (initial) and Meta BSP (future)
 * - Template-based messaging only
 * - Consistent interface across providers
 *
 * RULES:
 * - Only approved templates can be used
 * - Templates must be approved in WhatsApp Business Manager
 * - No free-text messages (compliance)
 */

// Twilio import - optional, will fail gracefully if not installed
let twilio: any;
try {
  twilio = require('twilio');
} catch (error) {
  console.warn('[WHATSAPP PROVIDER] Twilio package not installed. Install with: npm install twilio');
}

export interface SendTemplateMessageParams {
  to: string; // Phone number in E.164 format (e.g., +1234567890)
  templateName: string; // Approved template name
  language?: string; // Template language code (default: 'en')
  variables?: Record<string, string>; // Template variables
}

export interface SendTemplateMessageResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Twilio WhatsApp Provider Implementation
 */
class TwilioWhatsAppProvider {
  private client: any; // twilio.Twilio
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox

    if (!twilio) {
      console.warn('[WHATSAPP PROVIDER] Twilio package not installed');
      this.client = null;
    } else if (!accountSid || !authToken) {
      console.warn('[WHATSAPP PROVIDER] Twilio credentials not configured');
      this.client = null;
    } else {
      this.client = twilio(accountSid, authToken);
    }
  }

  async sendTemplateMessage(
    params: SendTemplateMessageParams
  ): Promise<SendTemplateMessageResult> {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
      }

      const { to, templateName, language = 'en', variables = {} } = params;

      // Format phone number (ensure E.164 format)
      const formattedTo = this.formatPhoneNumber(to);

      // Build template message body
      // Note: Twilio WhatsApp uses contentSid for approved templates
      // For now, we'll use a simplified approach with message body
      // In production, use Twilio Content API for approved templates

      // Convert variables to template format
      const templateBody = this.buildTemplateBody(templateName, variables);

      // Send via Twilio WhatsApp
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${formattedTo}`,
        body: templateBody,
      });

      return {
        success: true,
        providerMessageId: message.sid,
      };
    } catch (error: any) {
      console.error('[WHATSAPP PROVIDER] Twilio error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send WhatsApp message',
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If doesn't start with country code, assume default (e.g., +1 for US)
    // In production, you'd want to detect country code or require E.164 format
    if (!phone.startsWith('+')) {
      // Default to +1 (US) if no country code
      cleaned = '1' + cleaned;
    } else {
      cleaned = phone.replace(/\D/g, '');
    }

    return cleaned;
  }

  /**
   * Build template message body
   * In production, use Twilio Content API for approved templates
   */
  private buildTemplateBody(templateName: string, variables: Record<string, string>): string {
    // Template mappings (these should match approved templates in WhatsApp Business Manager)
    const templates: Record<string, string> = {
      abandoned_cart_1: `Hi {{name}}, you left {{itemCount}} items in your cart at {{storeName}}.\n\nComplete your order here 👉 {{recoveryLink}}`,
      abandoned_cart_2: `Your cart is waiting 🛒\n\nCheckout now before items go out of stock 👉 {{recoveryLink}}`,
      abandoned_cart_3: `Last chance to complete your order at {{storeName}}.\n\nResume here 👉 {{recoveryLink}}`,
    };

    let body = templates[templateName] || templates['abandoned_cart_1'];

    // Replace template variables
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      body = body.replace(regex, variables[key]);
    });

    return body;
  }
}

/**
 * Meta BSP Provider Implementation (Future)
 */
class MetaBSPProvider {
  async sendTemplateMessage(
    params: SendTemplateMessageParams
  ): Promise<SendTemplateMessageResult> {
    // TODO: Implement Meta BSP provider
    // This would use Meta's WhatsApp Business API
    throw new Error('Meta BSP provider not yet implemented');
  }
}

/**
 * WhatsApp Provider Factory
 */
export class WhatsAppProvider {
  private provider: TwilioWhatsAppProvider | MetaBSPProvider;

  constructor(providerType: 'twilio' | 'meta_bsp' = 'twilio') {
    if (providerType === 'twilio') {
      this.provider = new TwilioWhatsAppProvider();
    } else {
      this.provider = new MetaBSPProvider();
    }
  }

  async sendTemplateMessage(
    params: SendTemplateMessageParams
  ): Promise<SendTemplateMessageResult> {
    return this.provider.sendTemplateMessage(params);
  }
}

/**
 * Default provider instance
 */
export const whatsappProvider = new WhatsAppProvider(
  (process.env.WHATSAPP_PROVIDER as 'twilio' | 'meta_bsp') || 'twilio'
);

