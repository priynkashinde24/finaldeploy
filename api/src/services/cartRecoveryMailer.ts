import mongoose from 'mongoose';
import { sendMail } from '../utils/mailer';
import { Cart } from '../models/Cart';
import { CartRecoveryToken } from '../models/CartRecoveryToken';
import { CartRecoveryMetrics } from '../models/CartRecoveryMetrics';
import { Store } from '../models/Store';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';

/**
 * Cart Recovery Mailer Service
 *
 * PURPOSE:
 * - Build and send recovery emails
 * - Include cart items, pricing, recovery link
 * - Track email metrics
 * - Store branding
 */

export interface SendRecoveryEmailParams {
  cartId: string;
  email: string;
  emailNumber: number; // 1, 2, or 3
  token: string;
}

export interface SendRecoveryEmailResult {
  success: boolean;
  metricsId?: mongoose.Types.ObjectId;
  error?: string;
}

/**
 * Build recovery email HTML
 */
function buildRecoveryEmailHTML(
  storeName: string,
  storeLogo: string | undefined,
  items: Array<{
    productName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productImage?: string;
  }>,
  totalEstimate: number,
  recoveryUrl: string,
  emailNumber: number,
  token: string
): string {
  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        ${item.productImage ? `<img src="${item.productImage}" alt="${item.productName}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${item.productName || 'Product'}</strong><br>
        <span style="color: #666; font-size: 14px;">Qty: ${item.quantity}</span>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        ₹${item.totalPrice.toFixed(2)}
      </td>
    </tr>
  `
    )
    .join('');

  const subjectLine =
    emailNumber === 1
      ? `Complete your purchase at ${storeName}`
      : emailNumber === 2
      ? `Your cart is waiting for you at ${storeName}`
      : `Last chance! Special offer on your cart at ${storeName}`;

  const incentiveMessage =
    emailNumber === 3
      ? '<p style="color: #e74c3c; font-weight: bold; font-size: 18px;">🎁 Special Offer: Use code SAVE10 for 10% off!</p>'
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subjectLine}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    ${storeLogo ? `<img src="${storeLogo}" alt="${storeName}" style="max-width: 200px; margin-bottom: 20px;">` : ''}
    
    <h1 style="color: #2c3e50; margin-top: 0;">${subjectLine}</h1>
    
    <p>Hi there,</p>
    
    <p>We noticed you left some items in your cart. Don't miss out!</p>
    
    ${incentiveMessage}
    
    <h2 style="color: #2c3e50; margin-top: 30px;">Your Cart Items:</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Image</th>
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
          <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #ddd;">
            Total:
          </td>
          <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px; color: #e74c3c; border-top: 2px solid #ddd;">
            ₹${totalEstimate.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${recoveryUrl}" style="display: inline-block; background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
        Resume Your Cart
      </a>
    </div>
    
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      This link will expire in 7 days. If you have any questions, please contact our support team.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #666; font-size: 12px;">
      Don't want to receive these emails? 
      <a href="${recoveryUrl.split('?')[0]}?token=${token}&unsubscribe=true" style="color: #3498db;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `;
}

/**
 * Send recovery email
 */
export async function sendRecoveryEmail(
  params: SendRecoveryEmailParams
): Promise<SendRecoveryEmailResult> {
  const { cartId, email, emailNumber, token } = params;

  const cartObjId = typeof cartId === 'string' ? new mongoose.Types.ObjectId(cartId) : cartId;

  try {
    // STEP 1: Fetch cart
    const cart = await Cart.findById(cartObjId).populate('storeId', 'name slug customDomain branding');

    if (!cart) {
      return {
        success: false,
        error: 'Cart not found',
      };
    }

    // STEP 2: Check if cart is still abandoned
    if (cart.status !== 'abandoned') {
      return {
        success: false,
        error: `Cart is not abandoned. Current status: ${cart.status}`,
      };
    }

    // STEP 3: Check if token exists and is valid
    const recoveryToken = await CartRecoveryToken.findOne({
      cartId: cartObjId,
      token: token,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!recoveryToken) {
      return {
        success: false,
        error: 'Recovery token not found or expired',
      };
    }

    // STEP 4: Check if email already sent for this number
    const existingMetrics = await CartRecoveryMetrics.findOne({
      cartId: cartObjId,
      emailNumber,
    });

    if (existingMetrics) {
      // Email already sent, skip
      return {
        success: true,
        metricsId: existingMetrics._id,
      };
    }

    // STEP 5: Get store info
    const store = cart.storeId as any;
    const storeName = store.name || 'Our Store';
    const storeLogo = store.branding?.logo || store.logoUrl;
    const storeDomain = store.customDomain || `${store.slug}.yourdomain.com`; // TODO: Get actual domain

    // STEP 6: Build recovery URL
    const recoveryUrl = `https://${storeDomain}/cart/recover?token=${token}`;

    // STEP 7: Build email content
    const subject =
      emailNumber === 1
        ? `Complete your purchase at ${storeName}`
        : emailNumber === 2
        ? `Your cart is waiting for you at ${storeName}`
        : `Last chance! Special offer on your cart at ${storeName}`;

    const html = buildRecoveryEmailHTML(
      storeName,
      storeLogo,
      cart.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productImage: item.productImage,
      })),
      cart.totalEstimate,
      recoveryUrl,
      emailNumber,
      token
    );

    // STEP 8: Send email
    await sendMail(email, subject, html);

    // STEP 9: Update token
    recoveryToken.emailSentAt = new Date();
    recoveryToken.emailNumber = emailNumber;
    await recoveryToken.save();

    // STEP 10: Create metrics record
    const metrics = new CartRecoveryMetrics({
      storeId: cart.storeId,
      cartId: cartObjId,
      recoveryTokenId: recoveryToken._id,
      email: email.toLowerCase(),
      emailNumber,
      sentAt: new Date(),
    });

    await metrics.save();

    // STEP 11: Emit event
    eventStreamEmitter.emit('event', {
      eventType: 'CART_RECOVERY_EMAIL_SENT',
      payload: {
        cartId: cartObjId.toString(),
        email,
        emailNumber,
        metricsId: metrics._id.toString(),
      },
      storeId: cart.storeId.toString(),
      userId: cart.userId?.toString() || email,
      occurredAt: new Date(),
    });

    // STEP 12: Audit log
    await logAudit({
      storeId: cart.storeId.toString(),
      actorRole: 'system',
      action: 'CART_RECOVERY_EMAIL_SENT',
      entityType: 'Cart',
      entityId: cartObjId.toString(),
      description: `Recovery email ${emailNumber} sent for abandoned cart`,
      metadata: {
        cartId: cartObjId.toString(),
        email,
        emailNumber,
        metricsId: metrics._id.toString(),
      },
    });

    return {
      success: true,
      metricsId: metrics._id,
    };
  } catch (error: any) {
    console.error(`[CART RECOVERY MAILER] Error sending email:`, error);
    return {
      success: false,
      error: error.message || 'Failed to send recovery email',
    };
  }
}

