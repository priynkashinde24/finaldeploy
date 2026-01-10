import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Cart } from '../models/Cart';
import { CartRecoveryToken, generateRecoveryToken, hashToken } from '../models/CartRecoveryToken';
import { WhatsAppMessageLog } from '../models/WhatsAppMessageLog';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';

/**
 * WhatsApp Cart Recovery Scheduler Service
 *
 * PURPOSE:
 * - Schedule WhatsApp recovery messages for abandoned carts
 * - Generate recovery tokens
 * - Prevent duplicate messages
 * - Respect opt-in preferences
 *
 * RULES:
 * - WhatsApp messages ONLY if whatsappOptIn = true
 * - Max 1 WhatsApp per cart per 24h
 * - Templates only (no free text)
 * - Respect quiet hours
 */

export interface ScheduleWhatsAppRecoveryParams {
  cartId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string;
  phoneNumber?: string; // If not provided, fetch from user
}

export interface ScheduleWhatsAppRecoveryResult {
  success: boolean;
  messageLogIds?: mongoose.Types.ObjectId[];
  error?: string;
}

/**
 * Default WhatsApp schedule (in hours)
 */
const DEFAULT_WHATSAPP_SCHEDULE = [
  { delayHours: 1, messageType: 'abandoned_cart_1' as const },
  { delayHours: 24, messageType: 'abandoned_cart_2' as const },
  { delayHours: 72, messageType: 'abandoned_cart_3' as const },
];

/**
 * Get store WhatsApp recovery configuration
 */
async function getStoreWhatsAppConfig(
  storeId: mongoose.Types.ObjectId
): Promise<{
  enabled: boolean;
  maxAttempts: number;
  messageSchedule: Array<{ delayHours: number; messageType: 'abandoned_cart_1' | 'abandoned_cart_2' | 'abandoned_cart_3' }>;
  quietHoursStart?: number; // Hour of day (0-23)
  quietHoursEnd?: number; // Hour of day (0-23)
}> {
  const store = await Store.findById(storeId).lean();
  const storeAny = store as any;
  const config = storeAny?.metadata?.whatsappRecovery || {};

  return {
    enabled: config.enabled !== false, // Default: enabled
    maxAttempts: config.maxAttempts || 3, // Default: 3 messages
    messageSchedule: config.messageSchedule || DEFAULT_WHATSAPP_SCHEDULE,
    quietHoursStart: config.quietHoursStart || 22, // Default: 10 PM
    quietHoursEnd: config.quietHoursEnd || 8, // Default: 8 AM
  };
}

/**
 * Check if user has opted in to WhatsApp
 */
async function checkWhatsAppOptIn(
  userId: mongoose.Types.ObjectId | string | undefined,
  phoneNumber: string
): Promise<{ optedIn: boolean; user?: any }> {
  if (!userId) {
    // For guest carts, we can't check opt-in, so default to false
    return { optedIn: false };
  }

  const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  const user = await User.findById(userObjId).select('whatsappOptIn phoneNumber').lean();

  if (!user) {
    return { optedIn: false };
  }

  // Check if phone number matches and user has opted in
  const userPhone = user.phoneNumber || user.phone;
  const phoneMatches = userPhone && phoneNumber.replace(/\D/g, '') === userPhone.replace(/\D/g, '');

  return {
    optedIn: user.whatsappOptIn === true && phoneMatches === true,
    user,
  };
}

/**
 * Check if within quiet hours
 */
function isQuietHours(quietHoursStart: number, quietHoursEnd: number): boolean {
  const now = new Date();
  const currentHour = now.getHours();

  if (quietHoursStart > quietHoursEnd) {
    // Quiet hours span midnight (e.g., 22:00 - 08:00)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  } else {
    // Quiet hours within same day (e.g., 22:00 - 23:00)
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  }
}

/**
 * Schedule WhatsApp recovery messages for abandoned cart
 */
export async function scheduleWhatsAppRecovery(
  params: ScheduleWhatsAppRecoveryParams
): Promise<ScheduleWhatsAppRecoveryResult> {
  const { cartId, storeId, userId, phoneNumber } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const cartObjId = typeof cartId === 'string' ? new mongoose.Types.ObjectId(cartId) : cartId;

  try {
    return await withTransaction(async (session: ClientSession) => {
      // STEP 1: Fetch cart
      const cart = await Cart.findById(cartObjId).session(session);

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

      // STEP 3: Get phone number
      let userPhoneNumber = phoneNumber;
      if (!userPhoneNumber && userId) {
        const userObjId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        const user = await User.findById(userObjId).select('phoneNumber phone').session(session);
        userPhoneNumber = user?.phoneNumber || user?.phone;
      }

      if (!userPhoneNumber) {
        return {
          success: false,
          error: 'Phone number is required for WhatsApp recovery',
        };
      }

      // STEP 4: Check WhatsApp opt-in
      const optInCheck = await checkWhatsAppOptIn(userId, userPhoneNumber);
      if (!optInCheck.optedIn) {
        return {
          success: false,
          error: 'User has not opted in to WhatsApp messages',
        };
      }

      // STEP 5: Check store configuration
      const config = await getStoreWhatsAppConfig(storeObjId);
      if (!config.enabled) {
        return {
          success: false,
          error: 'WhatsApp recovery is disabled for this store',
        };
      }

      // STEP 6: Check if messages already scheduled
      const existingLogs = await WhatsAppMessageLog.find({
        cartId: cartObjId,
        status: { $in: ['queued', 'sent'] },
      }).session(session);

      if (existingLogs.length > 0) {
        // Messages already scheduled
        return {
          success: true,
          messageLogIds: existingLogs.map((log) => log._id),
        };
      }

      // STEP 7: Generate or get recovery token
      let recoveryToken = await CartRecoveryToken.findOne({
        cartId: cartObjId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (!recoveryToken) {
        const token = generateRecoveryToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        recoveryToken = new CartRecoveryToken({
          cartId: cartObjId,
          userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
          token: token,
          tokenHash: tokenHash,
          email: cart.email || '', // May be empty for WhatsApp-only recovery
          expiresAt,
        });

        await recoveryToken.save({ session });
      }

      // STEP 8: Get store info for template variables
      const store = await Store.findById(storeObjId).select('name slug customDomain').session(session);
      const storeName = store?.name || 'Our Store';
      const storeDomain = (store as any)?.customDomain || `${store?.slug}.yourdomain.com`;
      const recoveryUrl = `https://${storeDomain}/cart/recover?token=${recoveryToken.token}`;

      // STEP 9: Schedule messages
      const messageLogIds: mongoose.Types.ObjectId[] = [];
      const now = new Date();

      for (let i = 0; i < Math.min(config.maxAttempts, config.messageSchedule.length); i++) {
        const schedule = config.messageSchedule[i];
        if (!schedule) continue;

        const scheduledFor = new Date(now.getTime() + schedule.delayHours * 60 * 60 * 1000);

        // Check quiet hours - if scheduled time is in quiet hours, delay to next allowed time
        let adjustedScheduledFor = scheduledFor;
        if (isQuietHours(config.quietHoursStart || 22, config.quietHoursEnd || 8)) {
          // Delay to end of quiet hours
          const quietEnd = new Date(scheduledFor);
          quietEnd.setHours(config.quietHoursEnd || 8, 0, 0, 0);
          if (quietEnd <= scheduledFor) {
            quietEnd.setDate(quietEnd.getDate() + 1);
          }
          adjustedScheduledFor = quietEnd;
        }

        const messageLog = new WhatsAppMessageLog({
          storeId: storeObjId,
          cartId: cartObjId,
          userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
          phoneNumber: userPhoneNumber,
          templateName: `abandoned_cart_${i + 1}`, // Template name
          messageType: schedule.messageType,
          status: 'queued',
          scheduledFor: adjustedScheduledFor,
          recoveryTokenId: recoveryToken._id,
          provider: 'twilio', // Default to Twilio
          metadata: {
            storeName,
            itemCount: cart.items.length,
            recoveryUrl,
          },
        });

        await messageLog.save({ session });
        messageLogIds.push(messageLog._id);
      }

      // STEP 10: Audit log
      await logAudit({
        storeId: storeObjId.toString(),
        actorRole: 'system',
        action: 'WHATSAPP_RECOVERY_SCHEDULED',
        entityType: 'Cart',
        entityId: cartObjId.toString(),
        description: `WhatsApp recovery messages scheduled for abandoned cart`,
        metadata: {
          cartId: cartObjId.toString(),
          phoneNumber: userPhoneNumber,
          messageCount: messageLogIds.length,
          scheduledFor: messageLogIds.map((id) => id.toString()),
        },
      });

      return {
        success: true,
        messageLogIds,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to schedule WhatsApp recovery',
    };
  }
}

/**
 * Cancel scheduled WhatsApp messages (when cart is converted)
 */
export async function cancelWhatsAppRecovery(
  cartId: mongoose.Types.ObjectId | string
): Promise<void> {
  const cartObjId = typeof cartId === 'string' ? new mongoose.Types.ObjectId(cartId) : cartId;

  // Cancel all queued messages
  await WhatsAppMessageLog.updateMany(
    {
      cartId: cartObjId,
      status: 'queued',
    },
    {
      status: 'cancelled',
    }
  );
}

