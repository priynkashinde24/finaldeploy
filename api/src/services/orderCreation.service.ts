import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Order, IOrder, IOrderItem } from '../models/Order';
import { Store } from '../models/Store';
import { Product } from '../models/Product';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { User } from '../models/User';
import { generateOrderNumber } from '../utils/orderNumber';
import { generateIdempotencyKey, checkIdempotency, storeIdempotencyKey } from '../utils/idempotency';
import { reserveInventory, ReserveInventoryItem } from './inventoryReservation.service';
import { calculateTax, TaxCalculationResult, getTaxProfile } from '../utils/taxEngine';
import { calculateShipping, CalculateShippingResult } from '../utils/shippingEngine';
import { assignCourier, AssignCourierResult } from '../utils/courierEngine';
import { routeFulfillment, RouteFulfillmentParams } from '../utils/fulfillmentEngine';
import { calculateFinalPrice } from './pricingService';
import { resolvePricingRules } from '../utils/pricingEngine';
import { resolveDiscount } from '../utils/discountEngine';
import { applyStoreOverride } from '../utils/storePriceEngine';
import { validateMarkupRule } from '../utils/markupEngine';
import { canPlaceOrder } from '../utils/planGuard';
import { roundPrice } from './pricingService';
import { eventStreamEmitter } from '../controllers/eventController';
import { logAudit } from '../utils/auditLogger';
import { Request } from 'express';
import { Cart } from '../models/Cart';
import { cancelCartRecovery } from './cartRecoveryScheduler';
import { cancelWhatsAppRecovery } from './cartRecoveryWhatsAppScheduler';
import { CartRecoveryMetrics } from '../models/CartRecoveryMetrics';
import { WhatsAppRecoveryMetrics } from '../models/WhatsAppRecoveryMetrics';
import { getAttributionFromRequest, getUserAttributionSnapshot } from './attributionService';

/**
 * Get marketing attribution for order
 */
async function getMarketingAttributionForOrder(
  customerId?: mongoose.Types.ObjectId | string,
  req?: Request
): Promise<any> {
  try {
    // Default attribution model (can be configurable per store)
    const attributionModel = 'last_touch';

    // Try to get from user's signup attribution first
    if (customerId) {
      const userAttribution = await getUserAttributionSnapshot(customerId, attributionModel);
      if (userAttribution) {
        return {
          firstTouch: userAttribution.firstTouch,
          lastTouch: userAttribution.lastTouch,
          attributionModel,
          channelCredits: userAttribution.channelCredits,
          attributedAt: new Date(),
        };
      }
    }

    // Fallback to session attribution from request
    if (req) {
      const sessionAttribution = await getAttributionFromRequest(req, attributionModel);
      if (sessionAttribution) {
        return {
          firstTouch: sessionAttribution.firstTouch,
          lastTouch: sessionAttribution.lastTouch,
          attributionModel,
          channelCredits: sessionAttribution.channelCredits,
          attributedAt: new Date(),
        };
      }
    }

    return null;
  } catch (error: any) {
    console.error('[ORDER CREATION] Error getting marketing attribution:', error);
    return null;
  }
}

/**
 * Order Creation Service
 * 
 * PURPOSE:
 * - Create orders safely and atomically
 * - Integrate pricing, tax, inventory, payment, splits, invoices
 * - Prevent overselling, undercharging, double orders
 * - Support Stripe, PayPal, COD
 * - Be idempotent, auditable, and production-safe
 * 
 * FLOW:
 * 1. Validate (fail fast)
 * 2. Price resolution
 * 3. Reserve inventory
 * 4. Calculate tax
 * 5. Persist order
 * 6. Payment handoff
 * 7. Post-payment confirmation (webhook)
 */

export interface CreateOrderParams {
  storeId: mongoose.Types.ObjectId | string;
  customerId?: mongoose.Types.ObjectId | string;
  cartId?: mongoose.Types.ObjectId | string; // Cart ID for recovery tracking
  cartItems: Array<{
    productId: string;
    quantity: number;
    variantId?: string;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  paymentMethod: 'stripe' | 'paypal' | 'cod';
  couponCode?: string;
  customerEmail?: string;
  customerName?: string;
  req?: Request; // For audit logging
}

export interface CreateOrderResult {
  success: boolean;
  order?: IOrder;
  paymentPayload?: {
    paymentIntentId?: string;
    paypalOrderId?: string;
    clientSecret?: string;
    redirectUrl?: string;
  };
  error?: string;
}

/**
 * STEP 1-8: Create order (all steps in one transaction)
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const {
    storeId,
    customerId,
    cartItems,
    shippingAddress,
    billingAddress,
    paymentMethod,
    couponCode,
    customerEmail,
    customerName,
    req,
  } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  try {
    return await withTransaction(async (session: ClientSession) => {
      // STEP 1: Check idempotency
      const idempotencyKey = generateIdempotencyKey({
        storeId: storeObjId,
        customerId: customerId?.toString(),
        items: cartItems,
        shippingAddress,
        paymentMethod,
      });

      const existingOrder = await checkIdempotency(idempotencyKey, storeObjId);
      if (existingOrder.exists && existingOrder.orderId) {
        const order = await Order.findById(existingOrder.orderId).session(session);
        if (order) {
          return {
            success: true,
            order,
            error: 'Order already exists (idempotency)',
          };
        }
      }

      // STEP 2: Validation Phase (fail fast)
      const validationResult = await validateOrderRequest({
        storeId: storeObjId,
        customerId,
        cartItems,
        paymentMethod,
        session,
      });

      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error || 'Validation failed',
        };
      }

      const { store, resellerId, supplierIds } = validationResult;

      if (!resellerId) {
        return {
          success: false,
          error: 'Reseller ID not found',
        };
      }

      // STEP 3: Pricing Resolution
      const pricingResult = await resolvePricingForItems({
        storeId: storeObjId,
        resellerId,
        cartItems,
        couponCode,
        session,
      });

      if (!pricingResult.success) {
        return {
          success: false,
          error: pricingResult.error || 'Pricing resolution failed',
        };
      }

      const { orderItems, totalAmount, subtotal, discountAmount, variantReservationItems } = pricingResult;

      if (!orderItems || !subtotal || !variantReservationItems) {
        return {
          success: false,
          error: 'Pricing resolution incomplete',
        };
      }

      // STEP 2.5: Validate supplier tier restrictions (after pricing is calculated)
      // Check tier limits for each supplier
      if (supplierIds && supplierIds.length > 0) {
        for (const supplierId of supplierIds) {
        try {
          const { canProcessOrder } = await import('./kycTier.service');
          const { Order } = await import('../models/Order');
          
          // Calculate supplier's portion of order value
          const supplierItems = orderItems.filter((item: any) => 
            item.supplierId && item.supplierId.toString() === supplierId.toString()
          );
          const supplierOrderValue = supplierItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
          
          // Get monthly order count for supplier
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const monthlyOrders = await Order.countDocuments({
            supplierId: new mongoose.Types.ObjectId(supplierId),
            createdAt: { $gte: startOfMonth },
            status: { $in: ['paid', 'confirmed', 'processing', 'shipped', 'delivered'] },
          }).session(session);
          
          const tierCheck = await canProcessOrder(
            new mongoose.Types.ObjectId(supplierId),
            supplierOrderValue,
            monthlyOrders
          );
          
          if (!tierCheck.allowed) {
            return {
              success: false,
              error: `Supplier tier restriction: ${tierCheck.reason}`,
            };
          }
        } catch (error) {
          // Tier service not available or error - continue without tier check
          console.warn('[ORDER CREATION] Tier check failed, continuing without tier validation:', error);
        }
      }
      }

      // STEP 4: Fulfillment Routing (multi-origin)
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const fulfillmentRouteResult = await routeFulfillment({
        cartItems: orderItems
          .filter((item) => item.globalVariantId) // Filter out items without variant
          .map((item) => ({
            globalVariantId: item.globalVariantId!,
            quantity: item.quantity,
            supplierId: item.supplierId,
          })),
        deliveryAddress: shippingAddress,
        storeId: storeObjId,
        paymentMethod,
        orderValue: subtotal,
        req,
      });

      if (!fulfillmentRouteResult.success) {
        return {
          success: false,
          error: fulfillmentRouteResult.error || 'Fulfillment routing failed',
        };
      }

      // STEP 5: Inventory Reservation (transactional) - Now with origin-level
      const tempOrderId = new mongoose.Types.ObjectId(); // Temporary ID for reservation
      const originReservationItems = (fulfillmentRouteResult.items || []).map((item) => ({
        globalVariantId: item.globalVariantId,
        supplierId: item.supplierId,
        originId: item.originId,
        quantity: item.quantity,
      }));

      const reservationResult = await reserveInventory({
        storeId: storeObjId,
        orderId: tempOrderId,
        items: originReservationItems,
        expiresInMinutes: 15,
        metadata: {
          resellerId: resellerId || '',
          customerId: customerId || null,
          orderId,
        },
      });

      if (!reservationResult.success) {
        return {
          success: false,
          error: reservationResult.error || 'Inventory reservation failed',
        };
      }

      // STEP 6: Shipping Calculation (Snapshot) - Per origin or aggregate
      let shippingResult: CalculateShippingResult | null = null;
      let shippingAmount = 0;
      
      try {
        // Calculate order weight (default to 0.5 kg per item if not available)
        // TODO: Get actual weight from products when weight field is added
        const orderWeight = orderItems.reduce((total, item) => {
          // Default weight: 0.5 kg per item (can be enhanced when products have weight)
          return total + (item.quantity * 0.5);
        }, 0);

        shippingResult = await calculateShipping({
          storeId: storeObjId,
          shippingAddress,
          orderWeight,
          orderValue: subtotal,
          paymentMethod,
        });
        shippingAmount = shippingResult.snapshot.totalShipping;
      } catch (shippingError: any) {
        // If shipping zone/rate not found, block checkout
        return {
          success: false,
          error: shippingError.message || 'Shipping calculation failed. Please configure shipping zones and rates.',
        };
      }

      // STEP 7: Tax Calculation (Snapshot)
      const storeTaxProfile = await getTaxProfile('store', storeObjId.toString(), storeObjId);
      if (!storeTaxProfile) {
        return {
          success: false,
          error: 'Store tax profile not found. Please configure tax settings.',
        };
      }

      const taxResult = await calculateTax({
        orderItems: orderItems,
        storeTaxProfile,
        shippingAddress,
        storeId: storeObjId,
        subtotal,
      });

      // STEP 8: Courier Assignment (Snapshot) - Per origin (handled in fulfillment routing)
      let courierResult: AssignCourierResult | null = null;

      if (shippingResult && shippingResult.snapshot) {
        try {
          // Calculate order weight (same as shipping calculation)
          const orderWeight = orderItems.reduce((total, item) => {
            return total + (item.quantity * 0.5); // Default 0.5 kg per item
          }, 0);

          courierResult = await assignCourier({
            storeId: storeObjId,
            shippingZoneId: shippingResult.snapshot.zoneId,
            orderWeight,
            orderValue: subtotal,
            paymentMethod,
            shippingPincode: shippingAddress.zip,
          });
        } catch (courierError: any) {
          // If no courier found, block checkout
          return {
            success: false,
            error: courierError.message || 'Courier assignment failed. Please configure courier rules.',
          };
        }
      }

      // STEP 9: Generate order number
      const orderNumber = await generateOrderNumber(storeObjId);

      // STEP 10: Order Persistence
      // Referral attribution (if user has referral)
      let referralSnapshot: any = null;
      if (customerId) {
        try {
          const { UserReferral } = await import('../models/UserReferral');
          const customerObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
          const userReferral = await UserReferral.findOne({ userId: customerObjId }).lean();
          
          if (userReferral) {
            referralSnapshot = {
              referralCode: userReferral.referralCode,
              referrerId: userReferral.referrerId,
              referrerType: userReferral.referrerType,
              userReferralId: userReferral._id,
              attributedAt: new Date(),
            };

            // Update UserReferral with firstOrderId if not set (will be updated with actual order ID later)
            // Note: We'll update this after order is saved
          }
        } catch (error: any) {
          // Don't fail order creation on referral attribution error
          console.error('[REFERRAL ATTRIBUTION] Error:', error);
        }
      }

      const order = new Order({
        orderId,
        orderNumber,
        storeId: storeObjId,
        customerId: customerId ? (typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId) : null,
        resellerId: resellerId || '',
        supplierId: supplierIds && supplierIds.length === 1 ? supplierIds[0] : null,
        items: orderItems,
        totalAmount,
        subtotal,
        taxTotal: taxResult.snapshot.totalTax,
        referralSnapshot: referralSnapshot || undefined,
        marketingAttribution: await getMarketingAttributionForOrder(customerId, req),
        grandTotal: subtotal + taxResult.snapshot.totalTax + shippingAmount,
        status: 'pending',
        orderStatus: 'pending',
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'pending',
        inventoryStatus: 'reserved',
        customerEmail,
        customerName,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        couponCode: couponCode?.toUpperCase() || null,
        discountAmount,
        taxSnapshot: taxResult.snapshot,
        shippingSnapshot: shippingResult?.snapshot || null,
        courierSnapshot: courierResult?.snapshot || null,
        fulfillmentSnapshot: fulfillmentRouteResult.items && fulfillmentRouteResult.shipmentGroups
          ? {
              items: fulfillmentRouteResult.items.map((item) => ({
                globalVariantId: item.globalVariantId,
                quantity: item.quantity,
                supplierId: item.supplierId,
                originId: item.originId,
                originAddress: item.originAddress,
                courierId: item.courierId,
                shippingZoneId: item.shippingZoneId,
                shippingCost: item.shippingCost || 0,
              })),
              shipmentGroups: fulfillmentRouteResult.shipmentGroups,
              routedAt: new Date(),
            }
          : null,
        shippingAmount,
        totalAmountWithTax: subtotal + taxResult.snapshot.totalTax + shippingAmount,
      });

      await order.save({ session });

      // STEP 10a: Mark cart as converted (if cartId provided)
      if (params.cartId) {
        const cartObjId =
          typeof params.cartId === 'string' ? new mongoose.Types.ObjectId(params.cartId) : params.cartId;

        const cart = await Cart.findById(cartObjId).session(session);
        if (cart && cart.status !== 'converted') {
          cart.status = 'converted';
          cart.convertedAt = new Date();
          cart.convertedToOrderId = order._id;
          await cart.save({ session });

          // Cancel pending recovery emails
          await cancelCartRecovery(cartObjId);

          // Cancel pending WhatsApp messages
          await cancelWhatsAppRecovery(cartObjId);

          // Update email recovery metrics if exists
          const emailMetrics = await CartRecoveryMetrics.findOne({
            cartId: cartObjId,
            convertedAt: null,
          }).session(session);

          if (emailMetrics) {
            emailMetrics.convertedAt = new Date();
            emailMetrics.orderId = order._id;
            emailMetrics.revenue = order.grandTotal;
            await emailMetrics.save({ session });
          }

          // Update WhatsApp recovery metrics if exists
          const { WhatsAppRecoveryMetrics } = await import('../models/WhatsAppRecoveryMetrics');
          const whatsappMetrics = await WhatsAppRecoveryMetrics.findOne({
            cartId: cartObjId,
            convertedAt: null,
          }).session(session);

          if (whatsappMetrics) {
            whatsappMetrics.convertedAt = new Date();
            whatsappMetrics.orderId = order._id;
            whatsappMetrics.revenue = order.grandTotal;
            await whatsappMetrics.save({ session });
          }

          // Emit events
          eventStreamEmitter.emit('event', {
            eventType: 'CART_CONVERTED',
            payload: {
              cartId: cartObjId.toString(),
              orderId: order.orderId,
              revenue: order.grandTotal,
            },
            storeId: storeObjId.toString(),
            userId: customerId?.toString(),
            occurredAt: new Date(),
          });

          // Check if recovered via WhatsApp
          if (whatsappMetrics) {
            eventStreamEmitter.emit('event', {
              eventType: 'CART_RECOVERED_WHATSAPP',
              payload: {
                cartId: cartObjId.toString(),
                orderId: order.orderId,
                revenue: order.grandTotal,
                messageType: whatsappMetrics.messageType,
              },
              storeId: storeObjId.toString(),
              userId: customerId?.toString(),
              occurredAt: new Date(),
            });
          }

          // Audit log
          if (req) {
            await logAudit({
              req,
              action: 'CART_CONVERTED',
              entityType: 'Cart',
              entityId: cartObjId.toString(),
              description: `Cart converted to order ${order.orderNumber}`,
              metadata: {
                cartId: cartObjId.toString(),
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                revenue: order.grandTotal,
              },
            });
          }
        }
      }

      // Update reservation with actual order ID
      if (reservationResult.reservations) {
        for (const reservation of reservationResult.reservations) {
          reservation.orderId = order._id;
          await reservation.save({ session });
        }
      }

      // STEP 9: Store idempotency key
      await storeIdempotencyKey(idempotencyKey, order._id, storeObjId);

      // Audit log
      if (req) {
        await logAudit({
          req,
          action: 'ORDER_CREATED',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Order created: ${orderNumber}`,
          before: null,
          after: {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            totalAmount: order.grandTotal,
            itemCount: orderItems.length,
          },
          metadata: {
            paymentMethod,
            customerId: customerId?.toString(),
          },
        });
      }

      // Emit event
      eventStreamEmitter.emit('event', {
        eventType: 'ORDER_CREATED',
        payload: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          storeId: storeObjId.toString(),
          totalAmount: order.grandTotal,
          itemCount: orderItems.length,
        },
        storeId: storeObjId.toString(),
        userId: customerId?.toString(),
        occurredAt: new Date(),
      });

      // Audit log for shipping
      if (req && shippingResult) {
        await logAudit({
          req,
          action: 'SHIPPING_APPLIED_TO_ORDER',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Shipping applied: ${shippingResult.snapshot.zoneName} - ₹${shippingAmount}`,
          after: {
            zoneId: shippingResult.snapshot.zoneId.toString(),
            zoneName: shippingResult.snapshot.zoneName,
            rateType: shippingResult.snapshot.rateType,
            totalShipping: shippingAmount,
          },
          metadata: {
            slab: shippingResult.snapshot.slab,
            baseRate: shippingResult.snapshot.baseRate,
            variableRate: shippingResult.snapshot.variableRate,
            codSurcharge: shippingResult.snapshot.codSurcharge,
          },
        });
      }

      // Audit log for courier assignment
      if (req && courierResult) {
        await logAudit({
          req,
          action: 'COURIER_ASSIGNED',
          entityType: 'Order',
          entityId: order._id.toString(),
          description: `Courier assigned: ${courierResult.snapshot.courierName} (${courierResult.snapshot.courierCode})`,
          after: {
            courierId: courierResult.snapshot.courierId.toString(),
            courierName: courierResult.snapshot.courierName,
            courierCode: courierResult.snapshot.courierCode,
            ruleId: courierResult.snapshot.ruleId?.toString() || null,
            reason: courierResult.snapshot.reason,
          },
        });
      }

      // STEP 10: Payment Handoff (outside transaction - payment gateways don't support transactions)
      let paymentPayload: CreateOrderResult['paymentPayload'] = {};

      if (paymentMethod === 'stripe') {
        // Payment intent will be created in controller
        // Just return order for now
      } else if (paymentMethod === 'paypal') {
        // PayPal order will be created in controller
      } else if (paymentMethod === 'cod') {
        // COD - no payment payload needed
      }

      return {
        success: true,
        order,
        paymentPayload,
      };
    });
  } catch (error: any) {
    console.error('[ORDER CREATION] Error:', error);
    return {
      success: false,
      error: error.message || 'Order creation failed',
    };
  }
}

/**
 * STEP 2: Validation Phase (fail fast)
 */
async function validateOrderRequest(params: {
  storeId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId | string;
  cartItems: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  session: ClientSession;
}): Promise<{
  valid: boolean;
  error?: string;
  store?: any;
  resellerId?: string;
  supplierIds?: mongoose.Types.ObjectId[];
}> {
  const { storeId, customerId, cartItems, paymentMethod, session } = params;

  // Validate store
  const store = await Store.findById(storeId).session(session);
  if (!store) {
    return { valid: false, error: 'Store not found' };
  }
  if (store.status !== 'active') {
    return { valid: false, error: 'Store is not active' };
  }

  const resellerId = store.ownerId;

  // Validate reseller (plan limits)
  const planCheck = await canPlaceOrder(resellerId, 'reseller');
  if (!planCheck.allowed) {
    return { valid: false, error: planCheck.reason || 'Plan limit reached' };
  }

  // Validate customer (if logged in)
  if (customerId) {
    const customerObjId = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
    const customer = await User.findById(customerObjId).session(session);
    if (!customer) {
      return { valid: false, error: 'Customer not found' };
    }
  }

  // Validate items
  if (!cartItems || cartItems.length === 0) {
    return { valid: false, error: 'Cart is empty' };
  }

  const supplierIds = new Set<mongoose.Types.ObjectId>();

  for (const item of cartItems) {
    if (item.quantity <= 0) {
      return { valid: false, error: `Invalid quantity for product ${item.productId}` };
    }

    // Validate product exists and is active
    const product = await Product.findById(item.productId).session(session);
    if (!product) {
      return { valid: false, error: `Product not found: ${item.productId}` };
    }
    if (product.status !== 'active') {
      return { valid: false, error: `Product is not active: ${item.productId}` };
    }

    // Validate reseller product exists
    const resellerProduct = await ResellerProduct.findOne({
      storeId,
      resellerId,
      $or: [{ globalProductId: item.productId }, { productId: item.productId }],
      isActive: true,
    }).session(session);

    if (!resellerProduct) {
      return { valid: false, error: `Product not available for reseller: ${item.productId}` };
    }

    // Collect supplier IDs
    if (resellerProduct.supplierId) {
      supplierIds.add(new mongoose.Types.ObjectId(resellerProduct.supplierId));
    }
  }

  // Validate suppliers
  for (const supplierId of supplierIds) {
    const supplier = await User.findById(supplierId).session(session);
    if (!supplier) {
      return { valid: false, error: `Supplier not found: ${supplierId}` };
    }
    
    // Check supplier tier status (if tier system is enabled)
    try {
      const { getSupplierTier } = await import('./kycTier.service');
      const tierRecord = await getSupplierTier(supplierId);
      if (tierRecord && tierRecord.status !== 'active') {
        return { valid: false, error: `Supplier tier is not active. Status: ${tierRecord.status}` };
      }
    } catch (error) {
      // Tier service not available or error - continue without tier check
      console.warn('[ORDER VALIDATION] Tier check failed, continuing without tier validation:', error);
    }
  }

  // Validate payment method
  if (!['stripe', 'paypal', 'cod'].includes(paymentMethod)) {
    return { valid: false, error: `Invalid payment method: ${paymentMethod}` };
  }

  // COD eligibility check (if COD)
  if (paymentMethod === 'cod') {
    // TODO: Add COD eligibility rules (e.g., max amount, location restrictions)
  }

  return {
    valid: true,
    store,
    resellerId,
    supplierIds: Array.from(supplierIds),
  };
}

/**
 * STEP 3: Pricing Resolution
 */
async function resolvePricingForItems(params: {
  storeId: mongoose.Types.ObjectId;
  resellerId: string;
  cartItems: Array<{ productId: string; quantity: number; variantId?: string }>;
  couponCode?: string;
  session: ClientSession;
}): Promise<{
  success: boolean;
  orderItems?: IOrderItem[];
  totalAmount?: number;
  subtotal?: number;
  discountAmount?: number;
  variantReservationItems?: ReserveInventoryItem[];
  error?: string;
}> {
  const { storeId, resellerId, cartItems, couponCode, session } = params;

  const orderItems: IOrderItem[] = [];
  const variantReservationItems: ReserveInventoryItem[] = [];
  let totalAmount = 0;
  let totalDiscountAmount = 0;

  for (const cartItem of cartItems) {
    // Fetch product and reseller product
    const product = await Product.findById(cartItem.productId).session(session);
    if (!product) {
      return { success: false, error: `Product not found: ${cartItem.productId}` };
    }

    const resellerProduct = await ResellerProduct.findOne({
      storeId,
      resellerId,
      $or: [{ globalProductId: cartItem.productId }, { productId: cartItem.productId }],
      isActive: true,
    }).session(session);

    if (!resellerProduct) {
      return { success: false, error: `Reseller product not found: ${cartItem.productId}` };
    }

    // Get supplier product for cost
    const supplierProduct = await SupplierProduct.findOne({
      storeId,
      supplierId: resellerProduct.supplierId,
      globalProductId: cartItem.productId,
      isActive: true,
    }).session(session);

    if (!supplierProduct) {
      return { success: false, error: `Supplier product not found: ${cartItem.productId}` };
    }

    // Calculate pricing
    const supplierCost = supplierProduct.costPrice || 0;
    const resellerPrice = resellerProduct.resellerPrice || resellerProduct.sellingPrice || 0;

    // Apply pricing rules
    const pricingRules = await resolvePricingRules({
      productId: cartItem.productId,
      variantId: cartItem.variantId || null,
      categoryId: product.categoryId || null,
      supplierCost,
      proposedSellingPrice: resellerPrice,
      enforceOn: 'storefront',
    });
    let finalPrice = resellerPrice;

    // Apply store override
    const storeOverride = await applyStoreOverride({
      basePrice: resellerPrice,
      storeId,
      productId: cartItem.productId,
      variantId: cartItem.variantId || null,
      categoryId: product.categoryId || null,
      supplierCost,
    });
    if (storeOverride && storeOverride.wasOverridden) {
      finalPrice = storeOverride.overriddenPrice;
    }

    // Calculate line totals
    const lineSubtotal = finalPrice * cartItem.quantity;
    totalAmount += lineSubtotal;

    // Build order item
    const orderItem: IOrderItem = {
      globalProductId: product._id,
      globalVariantId: cartItem.variantId ? new mongoose.Types.ObjectId(cartItem.variantId) : undefined,
      productId: cartItem.productId,
      sku: product.slug || cartItem.productId,
      name: product.name,
      quantity: cartItem.quantity,
      unitPrice: finalPrice,
      totalPrice: lineSubtotal,
      supplierId: new mongoose.Types.ObjectId(resellerProduct.supplierId),
      supplierCost,
      resellerPrice: finalPrice,
      lineSubtotal,
    };

    orderItems.push(orderItem);

    // Build variant reservation item
    if (resellerProduct.globalVariantId) {
      variantReservationItems.push({
        globalVariantId: resellerProduct.globalVariantId,
        supplierId: new mongoose.Types.ObjectId(resellerProduct.supplierId),
        quantity: cartItem.quantity,
      });
    }
  }

  // Apply discounts
  let appliedDiscountAmount = 0;
  if (couponCode) {
    // TODO: Apply coupon discount
    // const couponResult = await applyCoupon(...);
    // appliedDiscountAmount = couponResult.discountAmount;
  }

  const subtotal = roundPrice(totalAmount - appliedDiscountAmount);
  totalDiscountAmount = appliedDiscountAmount;

  return {
    success: true,
    orderItems,
    totalAmount: roundPrice(totalAmount),
    subtotal,
    discountAmount: roundPrice(totalDiscountAmount),
    variantReservationItems,
  };
}

