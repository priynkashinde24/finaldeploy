import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Cart } from '../models/Cart';
import { CartRecoveryToken, generateRecoveryToken, hashToken } from '../models/CartRecoveryToken';
import { CartRecoveryUnsubscribe } from '../models/CartRecoveryUnsubscribe';
import { Store } from '../models/Store';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';

/**
 * Cart Recovery Scheduler Service
 *
 * PURPOSE:
 * - Schedule recovery emails for abandoned carts
 * - Generate recovery tokens
 * - Prevent duplicate emails
 * - Respect opt-out preferences
 *
 * RULES:
 * - One active token per cart
 * - Emails scheduled with delays (1hr, 24hr, 72hr)
 * - No emails if cart converted
 * - No emails if user opted out
 */

export interface ScheduleRecoveryParams {
  cartId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId | string;
  email: string;
  userId?: mongoose.Types.ObjectId | string;
}

export interface ScheduleRecoveryResult {
  success: boolean;
  tokenId?: mongoose.Types.ObjectId;
  error?: string;
}

/**
 * Default email schedule (in hours)
 */
const DEFAULT_EMAIL_SCHEDULE = [
  { delayHours: 1, emailNumber: 1 },
  { delayHours: 24, emailNumber: 2 },
  { delayHours: 72, emailNumber: 3 },
];

/**
 * Get store cart recovery configuration
 */
async function getStoreRecoveryConfig(
  storeId: mongoose.Types.ObjectId
): Promise<{
  enabled: boolean;
  maxAttempts: number;
  emailSchedule: Array<{ delayHours: number; emailNumber: number }>;
}> {
  const store = await Store.findById(storeId).lean();

  // TODO: Store configuration in Store model or StoreSettings model
  // For now, using defaults
  // Access metadata if it exists (may not be in schema)
  const storeAny = store as any;
  const config = storeAny?.metadata?.cartRecovery || {};

  return {
    enabled: config.enabled !== false, // Default: enabled
    maxAttempts: config.maxAttempts || 3, // Default: 3 emails
    emailSchedule: config.emailSchedule || DEFAULT_EMAIL_SCHEDULE,
  };
}

/**
 * Check if user has opted out of cart recovery emails
 */
async function isOptedOut(
  email: string,
  storeId: mongoose.Types.ObjectId
): Promise<boolean> {
  const unsubscribe = await CartRecoveryUnsubscribe.findOne({
    storeId,
    email: email.toLowerCase(),
  }).lean();

  return !!unsubscribe;
}

/**
 * Schedule recovery emails for abandoned cart
 */
export async function scheduleCartRecovery(
  params: ScheduleRecoveryParams
): Promise<ScheduleRecoveryResult> {
  const { cartId, storeId, email, userId } = params;

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

      // STEP 3: Check store configuration
      const config = await getStoreRecoveryConfig(storeObjId);
      if (!config.enabled) {
        return {
          success: false,
          error: 'Cart recovery is disabled for this store',
        };
      }

      // STEP 4: Check opt-out
      if (await isOptedOut(email, storeObjId)) {
        return {
          success: false,
          error: 'User has opted out of cart recovery emails',
        };
      }

      // STEP 5: Check if token already exists
      const existingToken = await CartRecoveryToken.findOne({
        cartId: cartObjId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(session);

      if (existingToken) {
        // Token already exists, return it
        return {
          success: true,
          tokenId: existingToken._id,
        };
      }

      // STEP 6: Generate recovery token
      const token = generateRecoveryToken();
      const tokenHash = hashToken(token);

      // Token expires in 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // STEP 7: Create recovery token
      const recoveryToken = new CartRecoveryToken({
        cartId: cartObjId,
        userId: userId ? (typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId) : null,
        token: token, // Store plain token for email (in production, consider encrypting)
        tokenHash: tokenHash,
        email: email.toLowerCase(),
        expiresAt,
      });

      await recoveryToken.save({ session });

      // STEP 8: Schedule first email (immediate or with delay)
      const firstEmailDelay = config.emailSchedule[0]?.delayHours || 1;
      const firstEmailDelayMs = firstEmailDelay * 60 * 60 * 1000;

      // Schedule emails (using setTimeout for now, in production use job queue)
      // TODO: Integrate with job queue (Bull, Agenda, etc.)
      setTimeout(async () => {
        try {
          const { sendRecoveryEmail } = await import('./cartRecoveryMailer');
          await sendRecoveryEmail({
            cartId: cartObjId.toString(),
            email,
            emailNumber: 1,
            token,
          });
        } catch (error: any) {
          console.error(`[CART RECOVERY] Failed to send email 1:`, error);
        }
      }, firstEmailDelayMs);

      // Schedule subsequent emails
      for (let i = 1; i < Math.min(config.maxAttempts, config.emailSchedule.length); i++) {
        const schedule = config.emailSchedule[i];
        if (!schedule) continue;

        const delayMs = schedule.delayHours * 60 * 60 * 1000;
        setTimeout(async () => {
          try {
            // Re-check cart status before sending
            const cartCheck = await Cart.findById(cartObjId);
            if (!cartCheck || cartCheck.status === 'converted') {
              return; // Cart converted, don't send
            }

            const { sendRecoveryEmail } = await import('./cartRecoveryMailer');
            await sendRecoveryEmail({
              cartId: cartObjId.toString(),
              email,
              emailNumber: schedule.emailNumber,
              token,
            });
          } catch (error: any) {
            console.error(`[CART RECOVERY] Failed to send email ${schedule.emailNumber}:`, error);
          }
        }, delayMs);
      }

      // Audit log
      await logAudit({
        storeId: storeObjId.toString(),
        actorRole: 'system',
        action: 'CART_RECOVERY_SCHEDULED',
        entityType: 'Cart',
        entityId: cartObjId.toString(),
        description: `Recovery emails scheduled for abandoned cart`,
        metadata: {
          cartId: cartObjId.toString(),
          email,
          maxAttempts: config.maxAttempts,
          emailSchedule: config.emailSchedule,
        },
      });

      return {
        success: true,
        tokenId: recoveryToken._id,
      };
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to schedule cart recovery',
    };
  }
}

/**
 * Cancel scheduled recovery emails (when cart is converted)
 */
export async function cancelCartRecovery(
  cartId: mongoose.Types.ObjectId | string
): Promise<void> {
  const cartObjId = typeof cartId === 'string' ? new mongoose.Types.ObjectId(cartId) : cartId;

  // Mark all active tokens as used (effectively canceling)
  await CartRecoveryToken.updateMany(
    {
      cartId: cartObjId,
      usedAt: null,
    },
    {
      usedAt: new Date(),
    }
  );
}

