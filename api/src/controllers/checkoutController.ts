import { Request, Response, NextFunction } from 'express';
import { Order, IOrder } from '../models/Order';
import { PayoutLedger } from '../models/PayoutLedger';
import { Store } from '../models/Store';
import { Product } from '../models/Product';
import { ResellerCatalog } from '../models/ResellerCatalog';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { calculateFinalPrice } from '../services/pricingService';
import { calculateSplitPayment } from '../services/payoutService';
import { validateCoupon, applyCoupon, Cart } from '../services/couponService';
import { CouponRedemption } from '../models/CouponRedemption';
import { CouponUsage } from '../models/CouponUsage';
import { eventStreamEmitter } from './eventController';
import { createResellerPayout, createSupplierPayout } from '../services/payoutCalculationService';
import { resolvePricingRules } from '../utils/pricingEngine';
import { resolveDiscount } from '../utils/discountEngine';
import { resolveDynamicPrice, getRecentOrderCount } from '../utils/dynamicPricingEngine';
import { calculateTax, getTaxProfile } from '../utils/taxEngine';
import { applyStoreOverride } from '../utils/storePriceEngine';
import { validateMarkupRule } from '../utils/markupEngine';
import { evaluateAndCreateMarginAlert } from '../utils/marginAlertEngine';
import { canPlaceOrder } from '../utils/planGuard';
import {
  getAvailableStock,
  createReservation,
  confirmCartReservations,
  releaseCartReservations,
} from '../services/reservation.service';
import {
  reserveInventory,
  releaseInventory,
  consumeInventory,
} from '../services/inventoryReservation.service';
import { ResellerVariantInventory } from '../models/ResellerVariantInventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { z } from 'zod';
import mongoose from 'mongoose';

// Validation schemas
const createPaymentIntentSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'At least one item is required'),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  shippingAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string(),
    })
    .optional(),
  couponCode: z.string().optional(),
  customerId: z.string().optional(),
  cartId: z.string().optional(), // Cart ID for reservations
});

/**
 * Create payment intent and order
 * POST /api/checkout/create-payment-intent
 */
export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createPaymentIntentSchema.parse(req.body);
    const { items, customerEmail, customerName, shippingAddress, couponCode, customerId, cartId } =
      validatedData;

    // Store is already resolved by resolveStore middleware
    if (!req.store) {
      sendError(res, 'Store not found', 404);
      return;
    }

    const storeId = req.store.storeId;
    const store = req.store.store; // Store document from middleware
    const resellerId = store.ownerId;

    // Check plan limits for order placement
    const planCheck = await canPlaceOrder(resellerId, 'reseller');
    if (!planCheck.allowed) {
      sendError(res, planCheck.reason || 'Plan limit reached', 403);
      return;
    }

    // Process items and calculate totals
    const orderItems: IOrder['items'] = [];
    const taxCalculationItems: Array<{
      productId: string;
      variantId?: string | null;
      categoryId?: string | null;
      amount: number;
    }> = [];
    let totalAmount = 0;
    let totalSupplierCost = 0;
    const supplierIds = new Set<string>();
    let totalDiscountAmount = 0;
    let appliedCouponId: string | null = null;
    let appliedPromotionIds: string[] = [];
    let anyStorePriceApplied = false; // Track if any item had store override

    // First pass: calculate base totals (without discounts)
    for (const item of items) {
      // Get product (filter by store)
      const product = await Product.findOne({
        _id: item.productId,
        storeId: storeId, // ✅ Filter by store
      });
      if (!product) {
        sendError(res, `Product not found: ${item.productId}`, 404);
        return;
      }

      // Try to find ResellerProduct first (new model) - filter by store
      // Use globalProductId for new model, productId for legacy
      let resellerProduct = await ResellerProduct.findOne({
        storeId: storeId, // ✅ Filter by store
        resellerId,
        $or: [
          { globalProductId: item.productId },
          { productId: item.productId }, // Legacy support
        ],
        isActive: true,
        status: 'active',
      });

      // Fallback to ResellerCatalog (old model) if ResellerProduct not found
      let catalogItem = null;
      if (!resellerProduct) {
        catalogItem = await ResellerCatalog.findOne({
          resellerId,
          supplierProductId: item.productId,
          status: 'active',
        });

        if (!catalogItem) {
          sendError(res, `Product ${item.productId} is not in reseller catalog`, 400);
          return;
        }
      }

      // Get supplier product to get cost price
      let supplierProduct: any = null;
      let supplierCost = 0;
      let variantId: mongoose.Types.ObjectId | null = null;

      if (resellerProduct) {
        supplierProduct = await SupplierProduct.findOne({
          storeId: storeId, // ✅ Filter by store
          supplierId: resellerProduct.supplierId,
          productId: resellerProduct.productId,
          variantId: resellerProduct.variantId || null,
          status: 'active',
        });

        if (!supplierProduct) {
          sendError(res, `Supplier product not found for product ${item.productId}`, 404);
          return;
        }

        supplierCost = supplierProduct.costPrice;
        variantId = resellerProduct.variantId || null;
      } else {
        // Fallback: try to find supplier product from old catalog
        supplierProduct = await SupplierProduct.findOne({
          storeId: storeId, // ✅ Filter by store
          productId: item.productId,
          status: 'active',
        });

        if (supplierProduct) {
          supplierCost = supplierProduct.costPrice;
        } else {
          // Last resort: use product.cost if available
          supplierCost = (product as any).cost || 0;
        }
      }

      // STEP 1: Determine base selling price
      let baseSellingPrice: number;
      if (resellerProduct) {
        baseSellingPrice = resellerProduct.resellerPrice || resellerProduct.sellingPrice || 0;
      } else if (catalogItem) {
        baseSellingPrice = catalogItem.resellerPrice;
      } else {
        sendError(res, `Cannot determine selling price for product ${item.productId}`, 400);
        return;
      }

      // STEP 2: Apply Store Price Override (if store provided)
      let currentPrice = baseSellingPrice;
      if (storeId) {
        const storeOverrideResult = await applyStoreOverride({
          basePrice: currentPrice,
          storeId,
          productId: item.productId,
          variantId: variantId || null,
          categoryId: product.categoryId as mongoose.Types.ObjectId,
          supplierCost,
        });
        if (storeOverrideResult.wasOverridden) {
          currentPrice = storeOverrideResult.overriddenPrice;
          anyStorePriceApplied = true;
        }
      }

      // STEP 3: Apply Dynamic Pricing Engine
      const recentOrderCount = await getRecentOrderCount(item.productId, 24); // Last 24 hours
      const dynamicPriceResolution = await resolveDynamicPrice({
        baseSellingPrice,
        productId: item.productId,
        variantId: variantId || null,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        currentStock: supplierProduct?.stockQuantity || 0,
        recentOrderCount,
      });

      // Use dynamically adjusted price if rule was applied, otherwise use base price
      const priceAfterDynamic = dynamicPriceResolution.adjusted
        ? dynamicPriceResolution.adjustedPrice
        : baseSellingPrice;

      // STEP 4 & 5: Apply discount engine (promotions + coupon) on dynamically adjusted price
      const discountResolution = await resolveDiscount({
        baseSellingPrice: priceAfterDynamic, // Pass dynamically adjusted price
        productId: item.productId,
        variantId: variantId || null,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        supplierCost,
        couponCode: couponCode || null,
        customerEmail: customerEmail,
        orderValue: totalAmount, // Will be updated after first pass
      });

      if (!discountResolution.success) {
        sendError(res, discountResolution.error || 'Discount application failed', 400);
        return;
      }

      const finalPrice = discountResolution.finalPrice;
      const discountBreakdown = discountResolution.discountBreakdown;

      // STEP 5: Validate final price against markup rules (prevent API tampering)
      const markupValidation = await validateMarkupRule({
        variantId: variantId || null,
        productId: item.productId,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        supplierCost,
        appliesTo: 'store',
        proposedSellingPrice: finalPrice,
      });

      if (!markupValidation.valid) {
        // Release any reservations if validation fails
        if (cartId) {
          await releaseCartReservations(cartId, 'cancelled', { storeId });
        }
        sendError(
          res,
          `Price validation failed for product ${product.name}: ${markupValidation.reason}`,
          400
        );
        return;
      }

      // STEP 5a: Check available stock (accounting for reservations) and create reservation
      if (resellerProduct) {
        const availableStock = await getAvailableStock(resellerProduct._id, { storeId });
        if (availableStock < item.quantity) {
          // Release any reservations if stock check fails
          if (cartId) {
            await releaseCartReservations(cartId, 'cancelled', { storeId });
          }
          sendError(
            res,
            `Insufficient stock for product ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
            400
          );
          return;
        }

        // Create or update reservation if cartId provided
        if (cartId) {
          const reservationResult = await createReservation({
            storeId,
            cartId,
            resellerProductId: resellerProduct._id,
            quantity: item.quantity,
            customerId: customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
            expiresInMinutes: 15, // 15 minutes reservation
            metadata: {
              productId: product._id.toString(),
              productName: product.name || 'Unknown Product',
            },
          });

          if (!reservationResult.success) {
            // Release any existing reservations if new reservation fails
            await releaseCartReservations(cartId, 'cancelled', { storeId });
            sendError(res, reservationResult.error || 'Failed to reserve inventory', 400);
            return;
          }
        }
      }

      // STEP 5b: Trigger margin alert evaluation (last safety check, non-blocking)
      evaluateAndCreateMarginAlert({
        sellingPrice: finalPrice,
        supplierCost,
        variantId: variantId || null,
        productId: item.productId,
        categoryId: product.categoryId as mongoose.Types.ObjectId,
        brandId: product.brandId as mongoose.Types.ObjectId | null,
        resellerId,
        appliesTo: 'store',
        scope: variantId ? 'variant' : 'product',
        scopeId: variantId || item.productId,
      }).catch((error) => {
        // Log but don't fail checkout
        console.error('[MARGIN ALERT] Failed to create alert at checkout:', error);
      });

      // Track discounts
      const itemDiscount = discountBreakdown.totalDiscount * item.quantity;
      totalDiscountAmount += itemDiscount;

      if (discountBreakdown.couponId && !appliedCouponId) {
        appliedCouponId = discountBreakdown.couponId;
      }

      if (discountBreakdown.promotionId && !appliedPromotionIds.includes(discountBreakdown.promotionId)) {
        appliedPromotionIds.push(discountBreakdown.promotionId);
      }

      const itemTotal = finalPrice * item.quantity;
      totalAmount += itemTotal;
      totalSupplierCost += supplierCost * item.quantity;

      const supplierId = resellerProduct
        ? resellerProduct.supplierId.toString()
        : supplierProduct
        ? supplierProduct.supplierId.toString()
        : (product as any).supplierId?.toString() || '';

      if (supplierId) {
        supplierIds.add(supplierId);
      }

      const productSku = (product as any).sku || product._id.toString();
      const globalProductId = resellerProduct?.globalProductId || product._id.toString();
      const globalVariantId = resellerProduct?.globalVariantId || variantId || undefined;

      orderItems.push({
        globalProductId: typeof globalProductId === 'string' ? new mongoose.Types.ObjectId(globalProductId) : globalProductId,
        globalVariantId: globalVariantId ? (typeof globalVariantId === 'string' ? new mongoose.Types.ObjectId(globalVariantId) : globalVariantId) : undefined,
        productId: product._id.toString(), // Legacy
        sku: productSku,
        name: product.name,
        quantity: item.quantity,
        unitPrice: finalPrice,
        totalPrice: itemTotal,
        supplierId: typeof supplierId === 'string' ? new mongoose.Types.ObjectId(supplierId) : supplierId,
        supplierCost: supplierCost,
        resellerPrice: finalPrice,
        lineSubtotal: itemTotal, // After discounts, before tax
      });

      // Prepare tax calculation data (after discounts)
      taxCalculationItems.push({
        productId: product._id.toString(),
        variantId: variantId ? variantId.toString() : null,
        categoryId: product.categoryId ? product.categoryId.toString() : null,
        amount: itemTotal, // Final amount after discounts
      });
    }

    // Round totals
    totalAmount = Math.round(totalAmount * 100) / 100;
    totalDiscountAmount = Math.round(totalDiscountAmount * 100) / 100;
    totalSupplierCost = Math.round(totalSupplierCost * 100) / 100;
    const finalAmount = totalAmount; // Amount after discounts, before tax

    // STEP 4: Calculate tax (AFTER discounts, as per safety rules)
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    
    // Get store tax profile
    const storeTaxProfile = await getTaxProfile('store', storeId, storeObjId);
    if (!storeTaxProfile) {
      sendError(res, 'Store tax profile not found. Please configure tax settings.', 400);
      return;
    }

    // Prepare shipping address for tax calculation
    const taxShippingAddress = shippingAddress || {
      country: 'IN', // Default to India
      state: undefined,
      city: undefined,
    };

    // Calculate tax using proper signature
    const taxResult = await calculateTax({
      orderItems: orderItems,
      storeTaxProfile,
      shippingAddress: taxShippingAddress,
      storeId: storeObjId,
      subtotal: finalAmount,
    });

    // Extract tax information from snapshot
    const taxType = taxResult.snapshot.taxType.toLowerCase() as 'gst' | 'vat' | null;
    const taxRate = taxResult.itemTaxes.length > 0 ? taxResult.itemTaxes[0].taxRate : 0;

    // Calculate shipping (if applicable, default to 0 for now)
    const shippingAmount = 0;

    // Calculate final total with tax and shipping
    const totalAmountWithTax = finalAmount + taxResult.snapshot.totalTax + shippingAmount;

    // Generate order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // STEP 5: Reserve variant inventory (transactional) - BEFORE order creation
    const variantReservationItems: Array<{
      globalVariantId: mongoose.Types.ObjectId;
      supplierId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    // Collect variant reservation items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const resellerProduct = await ResellerProduct.findOne({
        storeId: storeId,
        resellerId,
        $or: [
          { globalProductId: item.productId },
          { productId: item.productId },
        ],
        isActive: true,
      }).lean();

      if (resellerProduct && resellerProduct.globalVariantId) {
        variantReservationItems.push({
          globalVariantId: resellerProduct.globalVariantId,
          supplierId: resellerProduct.supplierId,
          quantity: item.quantity,
        });
      }
    }

    // Note: Variant inventory reservation will happen AFTER order creation
    // We'll use the order._id for reservations

    // Calculate split payment (assuming single supplier for now, or aggregate)
    // For multiple suppliers, we'd need to split by supplier, but for simplicity,
    // we'll use the primary supplier or aggregate costs
    // Use finalAmount (after discount) for split payment calculation
    const primarySupplierId = Array.from(supplierIds)[0];
    const splitPayment = calculateSplitPayment(finalAmount, totalSupplierCost, 5); // 5% platform fee

    // Create order with tax snapshot (immutable values)
    const order = new Order({
      orderId,
      storeId,
      resellerId,
      items: orderItems,
      totalAmount: totalAmount + totalDiscountAmount, // Base amount before discounts
      status: 'pending',
      customerEmail,
      customerName,
      shippingAddress,
      couponCode: couponCode?.toUpperCase() || null,
      couponId: appliedCouponId || null,
      discountAmount: totalDiscountAmount,
      subtotal: finalAmount, // Amount after discounts, before tax
      taxType: taxType,
      taxRate: taxRate,
      taxAmount: taxResult.snapshot.totalTax, // Total tax amount (snapshot)
      taxSnapshot: taxResult.snapshot, // Full tax snapshot
      shippingAmount: shippingAmount,
      totalAmountWithTax: totalAmountWithTax, // Final amount including tax and shipping
      storePriceApplied: anyStorePriceApplied, // Snapshot: whether store override was applied
      finalAmount: finalAmount, // Deprecated: kept for backward compatibility
    });

    await order.save();

    // STEP 6: Reserve variant inventory AFTER order creation (transactional)
    if (variantReservationItems.length > 0) {
      const reservationResult = await reserveInventory({
        storeId,
        orderId: order._id,
        items: variantReservationItems,
        expiresInMinutes: 15,
        metadata: {
          resellerId,
          customerId: customerId || null,
          orderId: order.orderId,
        },
      });

      if (!reservationResult.success) {
        // Release any cart reservations if variant reservation fails
        if (cartId) {
          await releaseCartReservations(cartId, 'cancelled', { storeId });
        }
        // Delete order if reservation fails
        await Order.findByIdAndDelete(order._id);
        sendError(res, reservationResult.error || 'Failed to reserve variant inventory', 400);
        return;
      }
    }

    // Confirm cart reservations if cartId provided (legacy)
    if (cartId) {
      const confirmResult = await confirmCartReservations(cartId, order._id, { storeId });
      if (confirmResult.errors.length > 0) {
        console.error('[RESERVATION] Failed to confirm some reservations:', confirmResult.errors);
      }
    }

    // Audit log: Order created
    try {
      const { logAudit } = await import('../utils/auditLogger');
      await logAudit({
        req,
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: order._id.toString(),
        description: `Order created (${orderId})`,
        before: null,
        after: order.toObject(),
        metadata: {
          orderId,
          storeId,
          totalAmount: totalAmountWithTax,
          itemCount: orderItems.length,
          couponCode: couponCode || null,
        },
      });
    } catch (err) {
      console.error('[AUDIT] Failed to log ORDER_CREATED:', err);
    }

    // Create payout records for reseller and supplier
    // This must happen immediately after order creation to snapshot prices
    try {
      await createResellerPayout(order);
      await createSupplierPayout(order);
    } catch (payoutError) {
      // Log error but don't fail order creation
      // Payouts can be created manually later if needed
      console.error('Error creating payout records:', payoutError);
    }

    // Emit order.created event
    eventStreamEmitter.emit('event', {
      eventType: 'order.created',
      payload: {
        orderId,
        storeId,
        totalAmount: totalAmount + totalDiscountAmount,
        finalAmount,
        discountAmount: totalDiscountAmount,
        itemCount: orderItems.length,
      },
      storeId,
      userId: customerId || undefined,
      occurredAt: new Date(),
    });

    // Create payout ledger entry
    const payoutLedger = new PayoutLedger({
      orderId,
      resellerId,
      supplierId: primarySupplierId, // For multi-supplier orders, this would need to be split
      platformFee: splitPayment.platformFee,
      supplierAmount: splitPayment.supplierAmount,
      resellerAmount: splitPayment.resellerAmount,
      totalAmount: splitPayment.totalAmount,
      stripeTransferGroup: orderId, // Use orderId as transfer_group
      status: 'pending',
    });

    await payoutLedger.save();

    // In a real implementation, create Stripe PaymentIntent here
    // For now, we'll return a mock payment intent ID
    const mockPaymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Update order with payment intent ID
    order.paymentIntentId = mockPaymentIntentId;
    await order.save();

    // Record coupon usage if coupon was used
    if (couponCode && appliedCouponId) {
      const couponUsage = new CouponUsage({
        couponId: new mongoose.Types.ObjectId(appliedCouponId),
        orderId,
        customerEmail: customerEmail || undefined,
        discountAmount: totalDiscountAmount,
      });

      await couponUsage.save();

      // Update coupon used count
      const { Coupon } = await import('../models/Coupon');
      await Coupon.findByIdAndUpdate(appliedCouponId, {
        $inc: { usedCount: 1 },
      });
    }

    // Return response with payment intent details (including tax)
    sendSuccess(
      res,
      {
        orderId,
        paymentIntentId: mockPaymentIntentId,
        clientSecret: `mock_secret_${mockPaymentIntentId}`, // In real implementation, use Stripe client secret
        amount: totalAmountWithTax, // Final amount including tax and shipping
        subtotal: finalAmount, // Amount after discounts, before tax
        discountAmount: totalDiscountAmount,
        taxType: taxType,
        taxRate: taxRate,
        taxAmount: taxResult.snapshot.totalTax,
        shippingAmount: shippingAmount,
        totalAmountWithTax: totalAmountWithTax,
        couponCode: couponCode?.toUpperCase() || null,
        transferGroup: orderId, // For Stripe Connect transfers
        currency: 'usd',
      },
      'Payment intent created successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

