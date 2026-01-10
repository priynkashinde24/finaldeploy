import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ResellerProduct } from '../models/ResellerProduct';
import { SupplierProduct } from '../models/SupplierProduct';
import { Product } from '../models/Product';
import { Brand } from '../models/Brand';
import { MarginAlert } from '../models/MarginAlert';
import { resolveMarkupRule } from '../utils/markupEngine';
import { sendSuccess, sendError } from '../utils/responseFormatter';

/**
 * Admin Compliance Controller
 * 
 * PURPOSE:
 * - Aggregate pricing compliance metrics
 * - Detect violations and risks
 * - Provide trend analytics
 * - Read-only insights (no price editing)
 */

/**
 * GET /admin/pricing-compliance/summary
 * Get compliance summary with KPIs
 */
export const getComplianceSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view compliance summary', 403);
      return;
    }

    const { brandId, regionId, resellerId } = req.query;

    // Build filter for reseller products
    const resellerProductFilter: any = { status: 'active' };
    if (resellerId) {
      resellerProductFilter.resellerId = new mongoose.Types.ObjectId(resellerId as string);
    }

    // Get all active reseller products
    const resellerProducts = await ResellerProduct.find(resellerProductFilter)
      .populate('productId', 'name brandId categoryId')
      .lean();

    // Get supplier products for cost prices
    const supplierProductIds = resellerProducts.map((rp) => ({
      supplierId: rp.supplierId,
      productId: rp.productId,
      variantId: rp.variantId || null,
    }));

    const supplierProducts = await SupplierProduct.find({
      status: 'active',
      $or: supplierProductIds.map((sp) => ({
        supplierId: sp.supplierId,
        productId: sp.productId,
        variantId: sp.variantId,
      })),
    }).lean();

    // Create a map for quick lookup
    const supplierProductMap = new Map();
    supplierProducts.forEach((sp) => {
      const key = `${sp.supplierId}_${sp.productId}_${sp.variantId || 'null'}`;
      supplierProductMap.set(key, sp);
    });

    // Evaluate compliance for each reseller product
    let totalProducts = 0;
    let compliantCount = 0;
    let nearRiskCount = 0;
    let violationCount = 0;
    let totalMargin = 0;
    const marginByBrand = new Map<string, { total: number; count: number }>();
    const marginByRegion = new Map<string, { total: number; count: number }>();
    const marginByReseller = new Map<string, { total: number; count: number }>();

    for (const rp of resellerProducts) {
      const product = rp.productId as any;
      if (!product) continue;

      // Apply filters
      if (brandId && product.brandId?.toString() !== brandId) continue;
      // Note: regionId filtering would require region data in product/order

      const key = `${rp.supplierId}_${rp.productId}_${rp.variantId || 'null'}`;
      const supplierProduct = supplierProductMap.get(key);
      if (!supplierProduct) continue;

      totalProducts++;
      const supplierCost = supplierProduct.costPrice;
      const sellingPrice = rp.sellingPrice ?? 0;
      const currentMargin = sellingPrice - supplierCost;
      const currentMarginPercent = supplierCost > 0 ? (currentMargin / supplierCost) * 100 : 0;

      totalMargin += currentMarginPercent;

      // Get expected minimum margin from markup rules
      try {
        const markupResult = await resolveMarkupRule({
          variantId: rp.variantId || null,
          productId: rp.productId,
          categoryId: product.categoryId as mongoose.Types.ObjectId,
          brandId: product.brandId as mongoose.Types.ObjectId | null,
          regionId: regionId ? new mongoose.Types.ObjectId(regionId as string) : null,
          supplierCost,
          appliesTo: 'reseller',
        });

        const expectedMinMargin = markupResult.minSellingPrice - supplierCost;
        const expectedMinMarginPercent =
          supplierCost > 0 ? (expectedMinMargin / supplierCost) * 100 : 0;

        // Check compliance
        if (currentMarginPercent >= expectedMinMarginPercent) {
          compliantCount++;
          // Check if near risk (within 5% of minimum)
          const deviation = ((currentMarginPercent - expectedMinMarginPercent) / expectedMinMarginPercent) * 100;
          if (deviation <= 5) {
            nearRiskCount++;
          }
        } else {
          violationCount++;
        }

        // Aggregate by brand
        if (product.brandId) {
          const brandKey = product.brandId.toString();
          if (!marginByBrand.has(brandKey)) {
            marginByBrand.set(brandKey, { total: 0, count: 0 });
          }
          const brandData = marginByBrand.get(brandKey);
          brandData!.total += currentMarginPercent;
          brandData!.count += 1;
        }

        // Aggregate by reseller
        const resellerKey = rp.resellerId.toString();
        if (!marginByReseller.has(resellerKey)) {
          marginByReseller.set(resellerKey, { total: 0, count: 0 });
        }
        const resellerData = marginByReseller.get(resellerKey);
        resellerData!.total += currentMarginPercent;
        resellerData!.count += 1;
      } catch (error) {
        // Skip if markup rule resolution fails
        console.error('[COMPLIANCE] Error resolving markup rule:', error);
      }
    }

    // Get alerts summary
    const alertFilter: any = {};
    if (resellerId) alertFilter.resellerId = new mongoose.Types.ObjectId(resellerId as string);

    const openAlerts = await MarginAlert.countDocuments({ ...alertFilter, status: 'open' });
    const highSeverityAlerts = await MarginAlert.countDocuments({
      ...alertFilter,
      severity: 'high',
      status: { $in: ['open', 'acknowledged'] },
    });
    const recentAlerts = await MarginAlert.countDocuments({
      ...alertFilter,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Format brand margins
    const brandIds = Array.from(marginByBrand.keys());
    const brands = await Brand.find({ _id: { $in: brandIds } }).lean();
    const brandMap = new Map(brands.map((b) => [b._id.toString(), b.name]));

    const marginByBrandFormatted = Array.from(marginByBrand.entries()).map(([brandId, data]) => ({
      brandId,
      brandName: brandMap.get(brandId) || 'Unknown',
      averageMargin: data.count > 0 ? data.total / data.count : 0,
      productCount: data.count,
    }));

    // Format reseller margins (would need to populate reseller names)
    const marginByResellerFormatted = Array.from(marginByReseller.entries()).map(
      ([resellerId, data]) => ({
        resellerId,
        averageMargin: data.count > 0 ? data.total / data.count : 0,
        productCount: data.count,
      })
    );

    sendSuccess(res, {
      totals: {
        products: totalProducts,
        compliantPercentage: totalProducts > 0 ? (compliantCount / totalProducts) * 100 : 0,
        nearRiskPercentage: totalProducts > 0 ? (nearRiskCount / totalProducts) * 100 : 0,
        violationPercentage: totalProducts > 0 ? (violationCount / totalProducts) * 100 : 0,
      },
      marginStats: {
        averageMargin: totalProducts > 0 ? totalMargin / totalProducts : 0,
        byBrand: marginByBrandFormatted,
        byRegion: marginByRegion.size > 0 ? Array.from(marginByRegion.entries()) : [],
        byReseller: marginByResellerFormatted,
      },
      alertsSummary: {
        open: openAlerts,
        highSeverity: highSeverityAlerts,
        recent: recentAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/pricing-compliance/violations
 * Get list of pricing violations
 */
export const getComplianceViolations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view compliance violations', 403);
      return;
    }

    const { brandId, regionId, resellerId, severity, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const resellerProductFilter: any = { status: 'active' };
    if (resellerId) {
      resellerProductFilter.resellerId = new mongoose.Types.ObjectId(resellerId as string);
    }

    const resellerProducts = await ResellerProduct.find(resellerProductFilter)
      .populate('productId', 'name brandId categoryId')
      .populate('resellerId', 'name email')
      .skip(skip)
      .limit(limitNum)
      .lean();

    const supplierProducts = await SupplierProduct.find({
      status: 'active',
      $or: resellerProducts.map((rp) => ({
        supplierId: rp.supplierId,
        productId: rp.productId,
        variantId: rp.variantId || null,
      })),
    }).lean();

    const supplierProductMap = new Map();
    supplierProducts.forEach((sp) => {
      const key = `${sp.supplierId}_${sp.productId}_${sp.variantId || 'null'}`;
      supplierProductMap.set(key, sp);
    });

    const violations: any[] = [];

    for (const rp of resellerProducts) {
      const product = rp.productId as any;
      if (!product) continue;

      if (brandId && product.brandId?.toString() !== brandId) continue;

      const key = `${rp.supplierId}_${rp.productId}_${rp.variantId || 'null'}`;
      const supplierProduct = supplierProductMap.get(key);
      if (!supplierProduct) continue;

      const supplierCost = supplierProduct.costPrice;
      const sellingPrice = rp.sellingPrice ?? 0;
      const currentMargin = sellingPrice - supplierCost;
      const currentMarginPercent = supplierCost > 0 ? (currentMargin / supplierCost) * 100 : 0;

      try {
        const markupResult = await resolveMarkupRule({
          variantId: rp.variantId || null,
          productId: rp.productId,
          categoryId: product.categoryId as mongoose.Types.ObjectId,
          brandId: product.brandId as mongoose.Types.ObjectId | null,
          regionId: regionId ? new mongoose.Types.ObjectId(regionId as string) : null,
          supplierCost,
          appliesTo: 'reseller',
        });

        const expectedMinMargin = markupResult.minSellingPrice - supplierCost;
        const expectedMinMarginPercent =
          supplierCost > 0 ? (expectedMinMargin / supplierCost) * 100 : 0;

        // Check if violation or near risk
        if (currentMarginPercent < expectedMinMarginPercent) {
          const deviation = ((currentMarginPercent - expectedMinMarginPercent) / expectedMinMarginPercent) * 100;
          const alertSeverity = deviation < -10 ? 'high' : deviation < -5 ? 'medium' : 'low';

          if (!severity || alertSeverity === severity) {
            violations.push({
              productId: rp.productId,
              variantId: rp.variantId || null,
              productName: product.name,
              brandId: product.brandId || null,
              brandName: null, // Would need to populate
              regionId: regionId || null,
              resellerId: rp.resellerId,
              resellerName: (rp.resellerId as any)?.name || 'Unknown',
              currentMargin: currentMargin,
              currentMarginPercent: currentMarginPercent,
              requiredMinMargin: expectedMinMargin,
              requiredMinMarginPercent: expectedMinMarginPercent,
              ruleViolated: 'markup_rule',
              severity: alertSeverity,
              deviationPercentage: deviation,
            });
          }
        } else if (currentMarginPercent >= expectedMinMarginPercent) {
          // Check if near risk
          const deviation = ((currentMarginPercent - expectedMinMarginPercent) / expectedMinMarginPercent) * 100;
          if (deviation <= 5 && (!severity || severity === 'low')) {
            violations.push({
              productId: rp.productId,
              variantId: rp.variantId || null,
              productName: product.name,
              brandId: product.brandId || null,
              brandName: null,
              regionId: regionId || null,
              resellerId: rp.resellerId,
              resellerName: (rp.resellerId as any)?.name || 'Unknown',
              currentMargin: currentMargin,
              currentMarginPercent: currentMarginPercent,
              requiredMinMargin: expectedMinMargin,
              requiredMinMarginPercent: expectedMinMarginPercent,
              ruleViolated: 'markup_rule',
              severity: 'low',
              deviationPercentage: deviation,
            });
          }
        }
      } catch (error) {
        // Skip if error
      }
    }

    // Populate brand names
    const brandIds = violations
      .map((v) => v.brandId)
      .filter((id) => id !== null)
      .map((id) => new mongoose.Types.ObjectId(id));
    if (brandIds.length > 0) {
      const brands = await Brand.find({ _id: { $in: brandIds } }).lean();
      const brandMap = new Map(brands.map((b) => [b._id.toString(), b.name]));
      violations.forEach((v) => {
        if (v.brandId) {
          v.brandName = brandMap.get(v.brandId.toString()) || 'Unknown';
        }
      });
    }

    sendSuccess(res, {
      violations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: violations.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/pricing-compliance/trends
 * Get trend analytics (last 30 days)
 */
export const getComplianceTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;

    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view compliance trends', 403);
      return;
    }

    const { days = 30 } = req.query;
    const daysNum = parseInt(days as string, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get margin alerts created in the period (proxy for violations)
    const alerts = await MarginAlert.find({
      createdAt: { $gte: cutoffDate },
    })
      .sort({ createdAt: 1 })
      .lean();

    // Group by date
    const violationsByDate = new Map<string, number>();
    const marginData: { date: string; avgMargin: number; violationCount: number }[] = [];

    alerts.forEach((alert) => {
      const date = alert.createdAt.toISOString().split('T')[0];
      violationsByDate.set(date, (violationsByDate.get(date) || 0) + 1);
    });

    // Get average margin from alerts metadata (simplified)
    // In production, you'd aggregate from orders or reseller products
    const avgMarginByDate = new Map<string, number[]>();

    alerts.forEach((alert) => {
      const date = alert.createdAt.toISOString().split('T')[0];
      if (!avgMarginByDate.has(date)) {
        avgMarginByDate.set(date, []);
      }
      avgMarginByDate.get(date)!.push(alert.currentMarginPercent);
    });

    // Generate date range
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (daysNum - i - 1));
      const dateStr = date.toISOString().split('T')[0];

      const violationCount = violationsByDate.get(dateStr) || 0;
      const margins = avgMarginByDate.get(dateStr) || [];
      const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

      marginData.push({
        date: dateStr,
        avgMargin,
        violationCount,
      });
    }

    // Margin distribution buckets
    const allMargins = alerts.map((a) => a.currentMarginPercent);
    const buckets = {
      '0-10%': 0,
      '10-20%': 0,
      '20-30%': 0,
      '30-40%': 0,
      '40-50%': 0,
      '50%+': 0,
    };

    allMargins.forEach((margin) => {
      if (margin < 10) buckets['0-10%']++;
      else if (margin < 20) buckets['10-20%']++;
      else if (margin < 30) buckets['20-30%']++;
      else if (margin < 40) buckets['30-40%']++;
      else if (margin < 50) buckets['40-50%']++;
      else buckets['50%+']++;
    });

    sendSuccess(res, {
      timeSeries: marginData,
      marginDistribution: buckets,
    });
  } catch (error) {
    next(error);
  }
};

