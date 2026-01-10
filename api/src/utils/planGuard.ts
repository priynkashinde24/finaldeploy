import mongoose from 'mongoose';
import { Subscription } from '../models/Subscription';
import { Plan } from '../models/Plan';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { ProductVariant } from '../models/ProductVariant';
import { Order } from '../models/Order';

/**
 * Plan Guard Utility
 * 
 * PURPOSE:
 * - Enforce plan limits and feature access
 * - Check usage against plan limits
 * - Return clear error messages
 * - Safe enforcement (no data loss)
 * 
 * RULES:
 * - Downgrade never deletes data
 * - Block actions beyond limits
 * - Soft enforcement (read allowed, write blocked)
 * - All checks are non-blocking for reads
 */

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number | null;
}

/**
 * Get user's active subscription
 */
export async function getUserSubscription(
  userId: mongoose.Types.ObjectId | string
): Promise<{ subscription: any; plan: any } | null> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subscription = await Subscription.findOne({
    userId: userObjId,
    status: { $in: ['trial', 'active', 'past_due'] },
  })
    .populate('planId')
    .lean();

  if (!subscription) {
    return null;
  }

  return {
    subscription,
    plan: subscription.planId,
  };
}

/**
 * Check if user can create a product (ResellerProduct or SupplierProduct)
 */
export async function canCreateProduct(
  userId: mongoose.Types.ObjectId | string,
  role: 'reseller' | 'supplier'
): Promise<PlanCheckResult> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subData = await getUserSubscription(userObjId);
  if (!subData) {
    return {
      allowed: false,
      reason: 'No active subscription. Please contact admin to assign a plan.',
    };
  }

  const { subscription, plan } = subData;

  // Check if plan is for correct role
  if (plan.role !== role) {
    return {
      allowed: false,
      reason: `Plan is for ${plan.role}, but you are a ${role}. Please contact admin.`,
    };
  }

  // Check maxProducts limit
  if (plan.features.maxProducts !== null) {
    const currentCount =
      role === 'reseller'
        ? await ResellerProduct.countDocuments({ resellerId: userObjId, status: 'active' })
        : await SupplierProduct.countDocuments({ supplierId: userObjId, status: 'active' });

    if (currentCount >= plan.features.maxProducts) {
      return {
        allowed: false,
        reason: `You have reached your plan limit of ${plan.features.maxProducts} products. Upgrade your plan to add more products.`,
        currentUsage: currentCount,
        limit: plan.features.maxProducts,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if user can create a variant
 */
export async function canCreateVariant(
  userId: mongoose.Types.ObjectId | string,
  role: 'reseller' | 'supplier'
): Promise<PlanCheckResult> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subData = await getUserSubscription(userObjId);
  if (!subData) {
    return {
      allowed: false,
      reason: 'No active subscription. Please contact admin to assign a plan.',
    };
  }

  const { plan } = subData;

  // Check if plan is for correct role
  if (plan.role !== role) {
    return {
      allowed: false,
      reason: `Plan is for ${plan.role}, but you are a ${role}. Please contact admin.`,
    };
  }

  // Check maxVariants limit
  if (plan.features.maxVariants !== null) {
    // Count variants across all products for this user
    // For resellers: count variants in their ResellerProducts
    // For suppliers: count variants in their SupplierProducts
    let currentCount = 0;

    if (role === 'reseller') {
      const resellerProducts = await ResellerProduct.find({
        resellerId: userObjId,
        status: 'active',
        variantId: { $ne: null },
      }).lean();
      currentCount = resellerProducts.length;
    } else {
      const supplierProducts = await SupplierProduct.find({
        supplierId: userObjId,
        status: 'active',
        variantId: { $ne: null },
      }).lean();
      currentCount = supplierProducts.length;
    }

    if (currentCount >= plan.features.maxVariants) {
      return {
        allowed: false,
        reason: `You have reached your plan limit of ${plan.features.maxVariants} variants. Upgrade your plan to add more variants.`,
        currentUsage: currentCount,
        limit: plan.features.maxVariants,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if user can place an order
 */
export async function canPlaceOrder(
  userId: mongoose.Types.ObjectId | string,
  role: 'reseller' | 'supplier'
): Promise<PlanCheckResult> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subData = await getUserSubscription(userObjId);
  if (!subData) {
    return {
      allowed: false,
      reason: 'No active subscription. Please contact admin to assign a plan.',
    };
  }

  const { subscription, plan } = subData;

  // Check if plan is for correct role
  if (plan.role !== role) {
    return {
      allowed: false,
      reason: `Plan is for ${plan.role}, but you are a ${role}. Please contact admin.`,
    };
  }

  // Check maxOrdersPerMonth limit
  if (plan.features.maxOrdersPerMonth !== null) {
    // Get current month's orders
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ordersThisMonth = await Order.countDocuments({
      ...(role === 'reseller' ? { resellerId: userObjId } : { supplierId: userObjId }),
      status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
      createdAt: { $gte: startOfMonth },
    });

    if (ordersThisMonth >= plan.features.maxOrdersPerMonth) {
      return {
        allowed: false,
        reason: `You have reached your monthly order limit of ${plan.features.maxOrdersPerMonth} orders. Upgrade your plan to increase your limit.`,
        currentUsage: ordersThisMonth,
        limit: plan.features.maxOrdersPerMonth,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if user can access a feature
 */
export async function canAccessFeature(
  userId: mongoose.Types.ObjectId | string,
  featureKey: 'analyticsAccess' | 'dynamicPricingAccess' | 'aiPricingAccess' | 'multiStoreAccess' | 'customDomainAccess' | 'prioritySupport'
): Promise<PlanCheckResult> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subData = await getUserSubscription(userObjId);
  if (!subData) {
    return {
      allowed: false,
      reason: 'No active subscription. Please contact admin to assign a plan.',
    };
  }

  const { plan } = subData;

  if (!plan.features[featureKey]) {
    const featureNames: Record<string, string> = {
      analyticsAccess: 'Analytics Dashboard',
      dynamicPricingAccess: 'Dynamic Pricing',
      aiPricingAccess: 'AI Pricing Suggestions',
      multiStoreAccess: 'Multiple Stores',
      customDomainAccess: 'Custom Domain',
      prioritySupport: 'Priority Support',
    };

    return {
      allowed: false,
      reason: `${featureNames[featureKey] || featureKey} is not available in your current plan. Upgrade your plan to access this feature.`,
    };
  }

  return { allowed: true };
}

/**
 * Get user's current usage stats
 */
export async function getUserUsage(
  userId: mongoose.Types.ObjectId | string,
  role: 'reseller' | 'supplier'
): Promise<{
  productsUsed: number;
  variantsUsed: number;
  ordersThisMonth: number;
  plan: any;
  subscription: any;
}> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const subData = await getUserSubscription(userObjId);
  if (!subData) {
    throw new Error('No active subscription found');
  }

  const { subscription, plan } = subData;

  // Count products
  const productsUsed =
    role === 'reseller'
      ? await ResellerProduct.countDocuments({ resellerId: userObjId, status: 'active' })
      : await SupplierProduct.countDocuments({ supplierId: userObjId, status: 'active' });

  // Count variants
  let variantsUsed = 0;
  if (role === 'reseller') {
    const resellerProducts = await ResellerProduct.find({
      resellerId: userObjId,
      status: 'active',
      variantId: { $ne: null },
    }).lean();
    variantsUsed = resellerProducts.length;
  } else {
    const supplierProducts = await SupplierProduct.find({
      supplierId: userObjId,
      status: 'active',
      variantId: { $ne: null },
    }).lean();
    variantsUsed = supplierProducts.length;
  }

  // Count orders this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ordersThisMonth = await Order.countDocuments({
    ...(role === 'reseller' ? { resellerId: userObjId } : { supplierId: userObjId }),
    status: { $in: ['paid', 'processing', 'shipped', 'delivered'] },
    createdAt: { $gte: startOfMonth },
  });

  return {
    productsUsed,
    variantsUsed,
    ordersThisMonth,
    plan,
    subscription,
  };
}

