import mongoose from 'mongoose';
import { IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';

/**
 * Return Policy Engine
 *
 * PURPOSE:
 * - Validate return eligibility based on policies
 * - Check return window, category rules, condition rules
 * - Support COD return rules
 * - Non-returnable product flags
 *
 * RULES:
 * - Return window (N days from delivery)
 * - Category-based return eligibility
 * - Condition-based approval
 * - COD return rules
 * - Non-returnable flags
 */

export interface ReturnPolicyConfig {
  returnWindowDays: number; // Default: 7 days
  allowPartialReturns: boolean; // Default: true
  allowMultiOriginReturns: boolean; // Default: true
  codReturnMethod: 'wallet' | 'cod_adjustment'; // Default: 'wallet'
  nonReturnableCategories?: string[]; // Category slugs that are non-returnable
  nonReturnableReasons?: string[]; // Reasons that make items non-returnable
  requireSealedCondition?: boolean; // If true, only sealed items can be returned
}

export interface ReturnItemRequest {
  globalVariantId: mongoose.Types.ObjectId | string;
  quantity: number;
  reason: string;
  condition: 'sealed' | 'opened' | 'damaged';
}

export interface ReturnValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Default return policy configuration
 */
const DEFAULT_POLICY: ReturnPolicyConfig = {
  returnWindowDays: 7,
  allowPartialReturns: true,
  allowMultiOriginReturns: true,
  codReturnMethod: 'wallet',
  nonReturnableCategories: [], // Can be configured per store
  nonReturnableReasons: [], // Can be configured per store
  requireSealedCondition: false, // Can be configured per store
};

/**
 * Get return policy for a store
 * TODO: Load from Store model or StoreSettings model
 * For now, using default policy
 */
async function getReturnPolicy(storeId: mongoose.Types.ObjectId): Promise<ReturnPolicyConfig> {
  // TODO: Load from Store model or StoreSettings model
  // const store = await Store.findById(storeId).select('returnPolicy').lean();
  // return store?.returnPolicy || DEFAULT_POLICY;
  return DEFAULT_POLICY;
}

/**
 * Check if order is within return window
 */
function isWithinReturnWindow(order: IOrder, policy: ReturnPolicyConfig): boolean {
  if (!order.orderStatus || order.orderStatus !== 'delivered') {
    return false; // Order must be delivered
  }

  // Find delivery date from status history or use updatedAt as fallback
  // TODO: Get actual delivery date from OrderStatusHistory
  const deliveryDate = order.updatedAt || order.createdAt;
  const returnDeadline = new Date(deliveryDate);
  returnDeadline.setDate(returnDeadline.getDate() + policy.returnWindowDays);

  return new Date() <= returnDeadline;
}

/**
 * Check if product/variant is returnable
 */
async function isProductReturnable(
  variantId: mongoose.Types.ObjectId | string,
  reason: string,
  policy: ReturnPolicyConfig
): Promise<{ returnable: boolean; error?: string }> {
  const variantObjId = typeof variantId === 'string' ? new mongoose.Types.ObjectId(variantId) : variantId;

  // Fetch variant and product
  const variant = await ProductVariant.findById(variantObjId)
    .populate({
      path: 'productId',
      select: 'categoryId status',
      populate: {
        path: 'categoryId',
        select: 'slug',
      },
    })
    .lean();

  if (!variant) {
    return { returnable: false, error: 'Variant not found' };
  }

  const product = variant.productId as any;
  if (!product || product.status !== 'active') {
    return { returnable: false, error: 'Product is not active' };
  }

  // Check non-returnable categories
  if (policy.nonReturnableCategories && product.categoryId) {
    const category = product.categoryId as any;
    if (category && policy.nonReturnableCategories.includes(category.slug)) {
      return { returnable: false, error: 'Product category is non-returnable' };
    }
  }

  // Check non-returnable reasons
  if (policy.nonReturnableReasons && policy.nonReturnableReasons.includes(reason.toLowerCase())) {
    return { returnable: false, error: `Return reason "${reason}" is not allowed` };
  }

  return { returnable: true };
}

/**
 * Validate return condition
 */
function validateCondition(condition: 'sealed' | 'opened' | 'damaged', policy: ReturnPolicyConfig): boolean {
  if (policy.requireSealedCondition && condition !== 'sealed') {
    return false;
  }
  return true;
}

/**
 * Validate return request
 *
 * @param order - Order to return items from
 * @param items - Items to return
 * @param storeId - Store ID
 * @returns Validation result
 */
export async function validateReturn(
  order: IOrder,
  items: ReturnItemRequest[],
  storeId: mongoose.Types.ObjectId | string
): Promise<ReturnValidationResult> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get return policy
  const policy = await getReturnPolicy(storeObjId);

  // STEP 1: Validate order status
  if (order.orderStatus !== 'delivered') {
    errors.push(`Order must be delivered to request return. Current status: ${order.orderStatus}`);
    return { valid: false, errors };
  }

  // STEP 2: Validate return window
  if (!isWithinReturnWindow(order, policy)) {
    errors.push(`Return window has expired. Returns must be requested within ${policy.returnWindowDays} days of delivery.`);
    return { valid: false, errors };
  }

  // STEP 3: Validate items exist in order
  const orderItemsMap = new Map(
    order.items.map((item) => [item.globalVariantId?.toString() || '', item.quantity])
  );

  for (const returnItem of items) {
    const variantId = typeof returnItem.globalVariantId === 'string'
      ? new mongoose.Types.ObjectId(returnItem.globalVariantId)
      : returnItem.globalVariantId;

    const variantKey = variantId.toString();
    const orderQuantity = orderItemsMap.get(variantKey);

    if (!orderQuantity) {
      errors.push(`Item ${variantKey} not found in order`);
      continue;
    }

    if (returnItem.quantity > orderQuantity) {
      errors.push(`Return quantity (${returnItem.quantity}) exceeds ordered quantity (${orderQuantity}) for item ${variantKey}`);
      continue;
    }

    // STEP 4: Validate product returnability
    const productCheck = await isProductReturnable(variantId, returnItem.reason, policy);
    if (!productCheck.returnable) {
      errors.push(`Item ${variantKey}: ${productCheck.error}`);
      continue;
    }

    // STEP 5: Validate condition
    if (!validateCondition(returnItem.condition, policy)) {
      errors.push(`Item ${variantKey}: Condition "${returnItem.condition}" is not allowed. Only sealed items can be returned.`);
      continue;
    }
  }

  // STEP 6: Validate partial returns (if policy disallows)
  if (!policy.allowPartialReturns && items.length < order.items.length) {
    errors.push('Partial returns are not allowed. All items must be returned.');
  }

  // STEP 7: Warnings (non-blocking)
  if (order.paymentMethod === 'cod' && policy.codReturnMethod === 'cod_adjustment') {
    warnings.push('COD returns will be adjusted in future orders');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

