import mongoose from 'mongoose';
import { AutoDiscountRule } from '../models/AutoDiscountRule';
import { DiscountProposal } from '../models/DiscountProposal';
import { DeadStockAlert } from '../models/DeadStockAlert';
import { ProductVariant } from '../models/ProductVariant';
import { ResellerProduct } from '../models/ResellerProduct';
import { logAudit } from '../utils/auditLogger';

/**
 * Auto Discount Engine
 * 
 * PURPOSE:
 * - Generate discount proposals from dead stock alerts
 * - Calculate optimal discount based on rules
 * - Require approval before application
 * 
 * RULES:
 * - Never auto-apply discounts
 * - Calculate based on days since last sale
 * - Consider stock value and level
 */

export interface GenerateDiscountProposalParams {
  storeId: mongoose.Types.ObjectId | string;
  scope: 'admin' | 'supplier' | 'reseller';
  entityId?: mongoose.Types.ObjectId | string | null;
  alertId: mongoose.Types.ObjectId | string;
}

export interface GenerateDiscountProposalResult {
  success: boolean;
  proposalId?: string;
  error?: string;
}

/**
 * Calculate discount percentage based on rule strategy
 */
function calculateDiscount(
  rule: any,
  daysSinceLastSale: number,
  currentPrice: number
): { discountPercent: number; proposedPrice: number; discountAmount: number } {
  let discountPercent = 0;

  switch (rule.discountStrategy) {
    case 'fixed':
      // Fixed discount amount
      const fixedAmount = rule.fixedDiscount || 0;
      discountPercent = currentPrice > 0 ? (fixedAmount / currentPrice) * 100 : 0;
      break;

    case 'percentage':
      // Fixed percentage
      discountPercent = rule.percentageDiscount || 0;
      break;

    case 'tiered':
      // Tiered based on days
      if (rule.tieredDiscounts && rule.tieredDiscounts.length > 0) {
        // Sort by daysThreshold descending to find matching tier
        const sortedTiers = [...rule.tieredDiscounts].sort((a, b) => b.daysThreshold - a.daysThreshold);
        for (const tier of sortedTiers) {
          if (daysSinceLastSale >= tier.daysThreshold) {
            discountPercent = tier.discountPercentage;
            break;
          }
        }
      }
      break;

    default:
      discountPercent = 0;
  }

  // Apply limits
  discountPercent = Math.max(rule.minDiscountPercent || 0, discountPercent);
  discountPercent = Math.min(rule.maxDiscountPercent || 50, discountPercent);

  const discountAmount = (currentPrice * discountPercent) / 100;
  const proposedPrice = Math.max(0, currentPrice - discountAmount);

  return { discountPercent, proposedPrice, discountAmount };
}

/**
 * Calculate expected impact of discount
 */
function calculateExpectedImpact(
  currentPrice: number,
  proposedPrice: number,
  stockLevel: number,
  daysSinceLastSale: number
): {
  revenueLoss: number;
  expectedSalesIncrease: number;
  breakEvenDays: number;
} {
  const discountPercent = ((currentPrice - proposedPrice) / currentPrice) * 100;
  const revenueLoss = (currentPrice - proposedPrice) * stockLevel;

  // Estimate sales increase based on discount (price elasticity approximation)
  // Higher discount = higher sales increase (simplified model)
  const expectedSalesIncrease = Math.min(100, discountPercent * 1.5); // 1.5x elasticity

  // Break-even: days to sell enough units to recover revenue loss
  // Simplified: assume we need to sell X% more units
  const avgDailySales = stockLevel / Math.max(daysSinceLastSale, 1);
  const requiredSalesIncrease = revenueLoss / proposedPrice;
  const breakEvenDays = avgDailySales > 0 ? requiredSalesIncrease / (avgDailySales * (1 + expectedSalesIncrease / 100)) : 999;

  return {
    revenueLoss,
    expectedSalesIncrease,
    breakEvenDays: Math.max(1, Math.ceil(breakEvenDays)),
  };
}

/**
 * Generate discount proposal from dead stock alert
 */
export async function generateDiscountProposal(
  params: GenerateDiscountProposalParams
): Promise<GenerateDiscountProposalResult> {
  try {
    const storeId = typeof params.storeId === 'string' ? new mongoose.Types.ObjectId(params.storeId) : params.storeId;
    const alertId = typeof params.alertId === 'string' ? new mongoose.Types.ObjectId(params.alertId) : params.alertId;

    // Get active discount rule
    const ruleQuery: any = {
      storeId,
      scope: params.scope,
      isActive: true,
    };

    if (params.entityId !== null && params.entityId !== undefined) {
      ruleQuery.entityId = params.entityId;
    } else {
      ruleQuery.entityId = null;
    }

    const rule = await AutoDiscountRule.findOne(ruleQuery).lean();
    if (!rule) {
      return { success: false, error: 'No active discount rule found for this scope' };
    }

    // Get dead stock alert
    const alert = await DeadStockAlert.findById(alertId).lean();
    if (!alert) {
      return { success: false, error: 'Dead stock alert not found' };
    }

    // Check if alert matches rule criteria
    if (alert.daysSinceLastSale < rule.minDaysSinceLastSale) {
      return { success: false, error: 'Alert does not meet minimum days threshold' };
    }
    if (alert.stockLevel < rule.minStockLevel) {
      return { success: false, error: 'Alert does not meet minimum stock level' };
    }
    if (rule.minStockValue > 0 && alert.stockValue < rule.minStockValue) {
      return { success: false, error: 'Alert does not meet minimum stock value' };
    }
    if (rule.severityFilter && !rule.severityFilter.includes(alert.severity)) {
      return { success: false, error: 'Alert severity does not match filter' };
    }

    // Check if proposal already exists
    const existingProposal = await DiscountProposal.findOne({
      storeId,
      scope: params.scope,
      entityId: params.entityId || null,
      skuId: alert.skuId,
      deadStockAlertId: alertId,
      status: 'pending',
    }).lean();

    if (existingProposal) {
      return { success: false, error: 'Proposal already exists for this alert' };
    }

    // Get current selling price
    const variant = await ProductVariant.findById(alert.skuId).lean();
    if (!variant) {
      return { success: false, error: 'Product variant not found' };
    }

    // Get reseller product for current price
    let currentPrice = variant.basePrice || 0;
    if (params.scope === 'reseller' && params.entityId) {
      const resellerProduct = await ResellerProduct.findOne({
        storeId,
        resellerId: params.entityId.toString(),
        variantId: alert.skuId,
        isActive: true,
      }).lean();

      if (resellerProduct) {
        currentPrice = resellerProduct.sellingPrice || resellerProduct.resellerPrice || currentPrice;
      }
    }

    if (currentPrice <= 0) {
      return { success: false, error: 'Cannot generate proposal: current price is zero or negative' };
    }

    // Calculate discount
    const discount = calculateDiscount(rule, alert.daysSinceLastSale, currentPrice);

    // Calculate expected impact
    const expectedImpact = calculateExpectedImpact(
      currentPrice,
      discount.proposedPrice,
      alert.stockLevel,
      alert.daysSinceLastSale
    );

    // Create proposal
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + rule.autoExpireDays);

    const proposal = await DiscountProposal.create({
      storeId,
      scope: params.scope,
      entityId: params.entityId || null,
      skuId: alert.skuId,
      sku: alert.sku,
      productId: alert.productId,
      deadStockAlertId: alertId,
      currentPrice,
      proposedPrice: discount.proposedPrice,
      discountPercent: discount.discountPercent,
      discountAmount: discount.discountAmount,
      status: 'pending',
      ruleId: rule._id,
      reason: `Dead stock alert: ${alert.daysSinceLastSale} days since last sale, ${alert.stockLevel} units in stock`,
      expectedImpact,
      proposedAt: new Date(),
      expiresAt,
    });

    // Log audit
    await logAudit({
      action: 'DISCOUNT_PROPOSAL_CREATED',
      actorId: null,
      actorRole: 'system',
      entityType: 'DiscountProposal',
      entityId: proposal._id.toString(),
      storeId: storeId.toString(),
      description: `Discount proposal created for SKU ${alert.sku}: ${discount.discountPercent.toFixed(1)}% off`,
      metadata: {
        scope: params.scope,
        skuId: alert.skuId.toString(),
        discountPercent: discount.discountPercent,
        currentPrice,
        proposedPrice: discount.proposedPrice,
      },
    });

    return { success: true, proposalId: proposal._id.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate proposals for all eligible dead stock alerts
 */
export async function generateProposalsForEligibleAlerts(
  storeId: mongoose.Types.ObjectId | string,
  scope: 'admin' | 'supplier' | 'reseller',
  entityId?: mongoose.Types.ObjectId | string | null
): Promise<{ generated: number; errors: string[] }> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  let generated = 0;
  const errors: string[] = [];

  try {
    // Get all open dead stock alerts
    const alertQuery: any = {
      storeId: storeObjId,
      scope,
      status: { $in: ['open', 'acknowledged'] },
    };

    if (entityId !== null && entityId !== undefined) {
      alertQuery.entityId = entityId;
    } else {
      alertQuery.entityId = null;
    }

    const alerts = await DeadStockAlert.find(alertQuery).lean();

    for (const alert of alerts) {
      try {
        const result = await generateDiscountProposal({
          storeId: storeObjId,
          scope,
          entityId,
          alertId: alert._id,
        });

        if (result.success) {
          generated++;
        } else {
          // Don't log "already exists" as error
          if (result.error && !result.error.includes('already exists')) {
            errors.push(`Alert ${alert._id}: ${result.error}`);
          }
        }
      } catch (error: any) {
        errors.push(`Alert ${alert._id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`Fatal error: ${error.message}`);
  }

  return { generated, errors };
}

