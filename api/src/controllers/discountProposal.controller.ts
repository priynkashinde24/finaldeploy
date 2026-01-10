import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { DiscountProposal } from '../models/DiscountProposal';
import { AutoDiscountRule } from '../models/AutoDiscountRule';
import { DeadStockAlert } from '../models/DeadStockAlert';
import { generateProposalsForEligibleAlerts } from '../services/autoDiscountEngine';
import { logAudit } from '../utils/auditLogger';
import { z } from 'zod';

/**
 * Discount Proposal Controller
 * 
 * Handles:
 * - Viewing discount proposals
 * - Approving/rejecting proposals
 * - Applying approved discounts
 * - Managing discount rules
 */

function getScopeAndEntity(user: any, storeId?: mongoose.Types.ObjectId | string): {
  scope: 'admin' | 'supplier' | 'reseller';
  entityId: mongoose.Types.ObjectId | string | null;
} {
  if (!user) throw new Error('User not authenticated');
  const userRole = user.role;
  if (userRole === 'admin') return { scope: 'admin', entityId: null };
  if (userRole === 'reseller') {
    const resellerId = user.id?.toString() || storeId?.toString() || '';
    return { scope: 'reseller', entityId: resellerId };
  }
  if (userRole === 'supplier') {
    const supplierId = user.id?.toString() || '';
    return { scope: 'supplier', entityId: supplierId ? new mongoose.Types.ObjectId(supplierId) : null };
  }
  throw new Error('Invalid user role');
}

/**
 * GET /discount-proposals
 * Get discount proposals
 */
export const getDiscountProposals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);
    const { status, limit = 50, skip = 0 } = req.query;

    const query: any = {
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    if (status) query.status = status as string;

    const proposals = await DiscountProposal.find(query)
      .populate('skuId', 'sku attributes')
      .populate('productId', 'name')
      .populate('deadStockAlertId', 'severity daysSinceLastSale stockLevel')
      .sort({ proposedAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await DiscountProposal.countDocuments(query);

    // Calculate metrics
    const pendingCount = await DiscountProposal.countDocuments({ ...query, status: 'pending' });
    const approvedCount = await DiscountProposal.countDocuments({ ...query, status: 'approved' });
    const totalPotentialRevenueLoss = await DiscountProposal.aggregate([
      { $match: { ...query, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$expectedImpact.revenueLoss' } } },
    ]);

    await logAudit({
      action: 'DISCOUNT_PROPOSALS_VIEWED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DiscountProposal',
      entityId: storeId.toString(),
      description: `Viewed discount proposals (scope: ${scope}, status: ${status || 'all'})`,
      metadata: { scope, status },
    });

    sendSuccess(res, {
      proposals,
      pagination: {
        total,
        limit: Number(limit),
        skip: Number(skip),
      },
      metrics: {
        pendingCount,
        approvedCount,
        totalPotentialRevenueLoss: totalPotentialRevenueLoss[0]?.total || 0,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /discount-proposals/:id
 * Get single discount proposal
 */
export const getDiscountProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const proposalId = req.params.id;

    if (!currentUser || !storeId || !proposalId) {
      sendError(res, 'Authentication, store, and proposal ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      _id: new mongoose.Types.ObjectId(proposalId),
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const proposal = await DiscountProposal.findOne(query)
      .populate('skuId', 'sku attributes basePrice images')
      .populate('productId', 'name description images')
      .populate('deadStockAlertId')
      .populate('ruleId', 'discountStrategy maxDiscountPercent')
      .lean();

    if (!proposal) {
      sendError(res, 'Proposal not found or access denied', 404);
      return;
    }

    sendSuccess(res, { proposal });
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /discount-proposals/:id/approve
 * Approve a discount proposal
 */
export const approveDiscountProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const proposalId = req.params.id;

    if (!currentUser || !storeId || !proposalId) {
      sendError(res, 'Authentication, store, and proposal ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    // Check if user role can approve
    const proposal = await DiscountProposal.findOne({
      _id: new mongoose.Types.ObjectId(proposalId),
      storeId,
      scope,
      status: 'pending',
    })
      .populate('ruleId', 'approvalRoles')
      .lean();

    if (!proposal) {
      sendError(res, 'Proposal not found, already processed, or access denied', 404);
      return;
    }

    const rule = proposal.ruleId as any;
    if (rule && rule.approvalRoles && !rule.approvalRoles.includes(currentUser.role)) {
      sendError(res, 'You do not have permission to approve this proposal', 403);
      return;
    }

    // Check if expired
    if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
      await DiscountProposal.updateOne(
        { _id: proposal._id },
        { $set: { status: 'expired' } }
      );
      sendError(res, 'Proposal has expired', 400);
      return;
    }

    // Update proposal
    const updated = await DiscountProposal.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(proposalId),
        storeId,
        scope,
        status: 'pending',
      },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: currentUser.id || currentUser.userId,
          approvedByRole: currentUser.role,
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'Failed to approve proposal', 500);
      return;
    }

    await logAudit({
      action: 'DISCOUNT_PROPOSAL_APPROVED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DiscountProposal',
      entityId: proposalId,
      description: `Approved discount proposal for SKU ${proposal.sku}: ${proposal.discountPercent.toFixed(1)}% off`,
      metadata: {
        scope,
        skuId: proposal.skuId.toString(),
        discountPercent: proposal.discountPercent,
      },
    });

    sendSuccess(res, { proposal: updated }, 'Proposal approved successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * PATCH /discount-proposals/:id/reject
 * Reject a discount proposal
 */
export const rejectDiscountProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    const proposalId = req.params.id;
    const { rejectionReason } = req.body;

    if (!currentUser || !storeId || !proposalId) {
      sendError(res, 'Authentication, store, and proposal ID required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const proposal = await DiscountProposal.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(proposalId),
        storeId,
        scope,
        status: 'pending',
      },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: currentUser.id || currentUser.userId,
          rejectionReason: rejectionReason || 'Rejected by user',
        },
      },
      { new: true }
    ).lean();

    if (!proposal) {
      sendError(res, 'Proposal not found, already processed, or access denied', 404);
      return;
    }

    await logAudit({
      action: 'DISCOUNT_PROPOSAL_REJECTED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DiscountProposal',
      entityId: proposalId,
      description: `Rejected discount proposal for SKU ${proposal.sku}`,
      metadata: {
        scope,
        skuId: proposal.skuId.toString(),
        rejectionReason,
      },
    });

    sendSuccess(res, { proposal }, 'Proposal rejected successfully');
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /discount-proposals/generate
 * Generate proposals for eligible alerts
 */
export const generateDiscountProposals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const result = await generateProposalsForEligibleAlerts(storeId, scope, entityId);

    await logAudit({
      action: 'DISCOUNT_PROPOSALS_GENERATED',
      actorId: currentUser.id || currentUser.userId,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      entityType: 'DiscountProposal',
      entityId: storeId.toString(),
      description: `Generated ${result.generated} discount proposals`,
      metadata: { scope, generated: result.generated, errors: result.errors.length },
    });

    sendSuccess(res, result, `Generated ${result.generated} proposals`);
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /discount-rules
 * Get discount rules
 */
export const getDiscountRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const query: any = {
      storeId,
      scope,
    };

    if (entityId !== null) query.entityId = entityId;
    else query.entityId = null;

    const rules = await AutoDiscountRule.find(query).sort({ createdAt: -1 }).lean();

    sendSuccess(res, { rules });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /discount-rules
 * Create or update discount rule
 */
export const createOrUpdateDiscountRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId ? new mongoose.Types.ObjectId(req.store.storeId) : null;
    if (!currentUser || !storeId) {
      sendError(res, 'Authentication and store required', 401);
      return;
    }

    const { scope, entityId } = getScopeAndEntity(currentUser, storeId);

    const ruleSchema = z.object({
      minDaysSinceLastSale: z.number().min(0),
      minStockLevel: z.number().min(0),
      minStockValue: z.number().min(0).optional(),
      severityFilter: z.array(z.enum(['warning', 'critical'])).optional(),
      discountStrategy: z.enum(['fixed', 'percentage', 'tiered']),
      fixedDiscount: z.number().min(0).optional(),
      percentageDiscount: z.number().min(0).max(100).optional(),
      tieredDiscounts: z
        .array(
          z.object({
            daysThreshold: z.number().min(0),
            discountPercentage: z.number().min(0).max(100),
          })
        )
        .optional(),
      maxDiscountPercent: z.number().min(0).max(100),
      minDiscountPercent: z.number().min(0).max(100),
      approvalRoles: z.array(z.enum(['admin', 'supplier', 'reseller'])),
      autoExpireDays: z.number().min(1),
      isActive: z.boolean(),
    });

    const validated = ruleSchema.parse(req.body);

    // Ensure requireApproval is always true (safety)
    const ruleData = {
      ...validated,
      requireApproval: true, // Always require approval (safety)
    };

    // Check if active rule exists
    const existingRuleQuery: any = {
      storeId,
      scope,
      isActive: true,
    };

    if (entityId !== null) existingRuleQuery.entityId = entityId;
    else existingRuleQuery.entityId = null;

    const existingRule = await AutoDiscountRule.findOne(existingRuleQuery).lean();

    if (existingRule && validated.isActive) {
      // Update existing rule
      const updated = await AutoDiscountRule.findByIdAndUpdate(
        existingRule._id,
        {
          $set: ruleData,
        },
        { new: true }
      ).lean();

      sendSuccess(res, { rule: updated }, 'Rule updated successfully');
    } else {
      // Deactivate existing rule if new one is active
      if (existingRule && validated.isActive) {
        await AutoDiscountRule.findByIdAndUpdate(existingRule._id, { $set: { isActive: false } });
      }

      // Create new rule
      const rule = await AutoDiscountRule.create({
        storeId,
        scope,
        entityId: entityId || null,
        ...ruleData,
      });

      sendSuccess(res, { rule }, 'Rule created successfully');
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, `Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400);
      return;
    }
    next(error);
  }
};

