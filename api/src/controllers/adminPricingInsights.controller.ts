import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PricingInsight } from '../models/PricingInsight';
import { Product } from '../models/Product';
import { ProductVariant } from '../models/ProductVariant';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * Admin Pricing Insights Controller
 * 
 * PURPOSE:
 * - Provide access to AI-generated pricing suggestions
 * - Advisory only - never auto-applies prices
 * - Fully respects Admin Pricing Rules
 * 
 * RULES:
 * - Admin-only access
 * - Insights are read-only
 * - Suggestions never override admin pricing rules
 */

/**
 * GET /admin/pricing-insights
 * List all pricing insights (admin only)
 */
export const listPricingInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view pricing insights', 403);
      return;
    }

    // Query parameters
    const scope = req.query.scope as string | undefined;
    const expired = req.query.expired as string | undefined; // 'true' to include expired

    // Build query
    const query: any = {};
    if (scope) {
      query.scope = scope;
    }

    // Filter expired insights
    if (expired !== 'true') {
      query.expiresAt = { $gte: new Date() }; // Only non-expired insights
    }

    // Fetch insights
    const insights = await PricingInsight.find(query)
      .sort({ createdAt: -1 })
      .limit(100); // Limit to most recent 100

    // Populate product/variant names for better UX
    const insightsWithNames = await Promise.all(
      insights.map(async (insight) => {
        let name = 'Unknown';
        let sku = '';

        if (insight.scope === 'product') {
          const product = await Product.findById(insight.scopeId).lean();
          if (product) {
            name = product.name;
            sku = (product as any).sku || '';
          }
        } else if (insight.scope === 'variant') {
          const variant = await ProductVariant.findById(insight.scopeId).lean();
          if (variant) {
            sku = variant.sku;
            const product = await Product.findById(variant.productId).lean();
            if (product) {
              name = `${product.name} - ${variant.sku}`;
            } else {
              name = variant.sku;
            }
          }
        }

        return {
          ...insight.toObject(),
          scopeName: name,
          scopeSku: sku,
        };
      })
    );

    sendSuccess(
      res,
      { insights: insightsWithNames, count: insightsWithNames.length },
      'Pricing insights retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/pricing-insights/:scope/:id
 * Get pricing insight for a specific product or variant (admin only)
 */
export const getPricingInsight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view pricing insights', 403);
      return;
    }

    const { scope, id } = req.params;

    if (!['product', 'variant'].includes(scope)) {
      sendError(res, 'Invalid scope. Must be "product" or "variant"', 400);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      sendError(res, 'Invalid ID', 400);
      return;
    }

    // Find most recent non-expired insight
    const insight = await PricingInsight.findOne({
      scope,
      scopeId: new mongoose.Types.ObjectId(id),
      expiresAt: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!insight) {
      sendError(res, 'No active pricing insight found for this item', 404);
      return;
    }

    // Populate product/variant name
    let name = 'Unknown';
    let sku = '';

    if (scope === 'product') {
      const product = await Product.findById(id).lean();
      if (product) {
        name = product.name;
        sku = (product as any).sku || '';
      }
    } else if (scope === 'variant') {
      const variant = await ProductVariant.findById(id).lean();
      if (variant) {
        sku = variant.sku;
        const product = await Product.findById(variant.productId).lean();
        if (product) {
          name = `${product.name} - ${variant.sku}`;
        } else {
          name = variant.sku;
        }
      }
    }

    sendSuccess(
      res,
      {
        insight: {
          ...insight,
          scopeName: name,
          scopeSku: sku,
        },
      },
      'Pricing insight retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/pricing-insights/generate
 * Manually trigger insight generation for a product/variant (admin only)
 */
export const generatePricingInsight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can generate pricing insights', 403);
      return;
    }

    const { scope, scopeId } = req.body;

    if (!['product', 'variant'].includes(scope)) {
      sendError(res, 'Invalid scope. Must be "product" or "variant"', 400);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(scopeId)) {
      sendError(res, 'Invalid scope ID', 400);
      return;
    }

    // Import the insight generation function
    const { generateInsightForScope } = await import('../jobs/pricingInsights.job');

    // Generate insight
    const insight = await generateInsightForScope(scope, new mongoose.Types.ObjectId(scopeId));

    if (!insight) {
      sendError(res, 'Failed to generate pricing insight', 500);
      return;
    }

    sendSuccess(res, { insight }, 'Pricing insight generated successfully', 201);
  } catch (error) {
    next(error);
  }
};

