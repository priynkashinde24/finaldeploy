import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { sendError, sendSuccess } from '../utils/responseFormatter';
import { SupplierKYCTier, KYCTier, TIER_DEFINITIONS } from '../models/SupplierKYCTier';
import { SupplierKYC } from '../models/SupplierKYC';
import { User } from '../models/User';
import {
  assignTier,
  checkTierRequirements,
  getSupplierTier,
  canProcessOrder,
  getPayoutDelayDays,
  getCommissionRate,
} from '../services/kycTier.service';
import { logAudit } from '../utils/auditLogger';

/**
 * Supplier KYC Tier Controller
 * 
 * Handles tier assignment, upgrades, downgrades, and tier information
 */

const assignTierSchema = z.object({
  supplierId: z.string(),
  tier: z.enum(['tier1', 'tier2', 'tier3']),
  reason: z.string().optional(),
});

/**
 * GET /admin/kyc-tiers
 * List all supplier tiers with filters
 */
export const listSupplierTiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const { tier, status, supplierId } = req.query;

    const filter: any = {};
    if (tier) filter.currentTier = tier;
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = new mongoose.Types.ObjectId(supplierId as string);

    const tiers = await SupplierKYCTier.find(filter)
      .populate('supplierId', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ assignedAt: -1 })
      .lean();

    sendSuccess(res, {
      tiers: tiers.map((t) => ({
        id: t._id.toString(),
        supplierId: t.supplierId,
        supplierName: (t.supplierId as any).name,
        supplierEmail: (t.supplierId as any).email,
        currentTier: t.currentTier,
        status: t.status,
        assignedAt: t.assignedAt,
        assignedBy: t.assignedBy,
        benefits: t.benefits,
        tierHistory: t.tierHistory,
      })),
      total: tiers.length,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /admin/kyc-tiers/:supplierId
 * Get supplier's tier information
 */
export const getSupplierTierInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    const { supplierId } = req.params;

    // Suppliers can only view their own tier, admins can view any
    if (!currentUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.id !== supplierId) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const tierRecord = await getSupplierTier(new mongoose.Types.ObjectId(supplierId));
    const kyc = await SupplierKYC.findOne({ supplierId: new mongoose.Types.ObjectId(supplierId) });

    if (!tierRecord) {
      // Check what tier they're eligible for
      const tier1Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier1');
      const tier2Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier2');
      const tier3Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier3');

      sendSuccess(res, {
        tier: null,
        kycStatus: kyc?.status || 'not_submitted',
        eligibleTiers: {
          tier1: tier1Check.eligible,
          tier2: tier2Check.eligible,
          tier3: tier3Check.eligible,
        },
        tierDefinitions: TIER_DEFINITIONS,
      });
      return;
    }

    // Check eligibility for higher tiers
    const tier1Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier1');
    const tier2Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier2');
    const tier3Check = await checkTierRequirements(new mongoose.Types.ObjectId(supplierId), 'tier3');

    sendSuccess(res, {
      tier: {
        id: tierRecord._id.toString(),
        currentTier: tierRecord.currentTier,
        status: tierRecord.status,
        assignedAt: tierRecord.assignedAt,
        assignedBy: tierRecord.assignedBy,
        benefits: tierRecord.benefits,
        requirements: tierRecord.requirements,
        tierHistory: tierRecord.tierHistory,
      },
      kycStatus: kyc?.status || 'not_submitted',
      eligibleTiers: {
        tier1: tier1Check.eligible,
        tier2: tier2Check.eligible,
        tier3: tier3Check.eligible,
      },
      canUpgrade: {
        tier2: tier2Check.eligible && tierRecord.currentTier === 'tier1',
        tier3: tier3Check.eligible && (tierRecord.currentTier === 'tier1' || tierRecord.currentTier === 'tier2'),
      },
      tierDefinitions: TIER_DEFINITIONS,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /admin/kyc-tiers/assign
 * Assign or upgrade/downgrade supplier tier (Admin only)
 */
export const assignSupplierTier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    const validatedData = assignTierSchema.parse(req.body);
    const { supplierId, tier, reason } = validatedData;

    // Verify supplier exists
    const supplier = await User.findById(supplierId);
    if (!supplier || supplier.role !== 'supplier') {
      sendError(res, 'Supplier not found', 404);
      return;
    }

    // Assign tier
    const result = await assignTier({
      supplierId: new mongoose.Types.ObjectId(supplierId),
      tier,
      assignedBy: new mongoose.Types.ObjectId(currentUser.id),
      reason,
    });

    if (!result.success) {
      sendError(res, result.error || 'Failed to assign tier', 400);
      return;
    }

    // Audit log
    await logAudit({
      actorId: currentUser.id,
      actorRole: currentUser.role as 'admin' | 'supplier' | 'reseller',
      action: 'TIER_ASSIGNED',
      entityType: 'SupplierKYCTier',
      entityId: result.tier!._id.toString(),
      description: `Admin assigned ${tier} to supplier: ${supplier.email}`,
      req,
      metadata: {
        supplierId,
        supplierEmail: supplier.email,
        tier,
        reason: reason || 'Tier assignment',
      },
    });

    sendSuccess(
      res,
      {
        tier: {
          id: result.tier!._id.toString(),
          currentTier: result.tier!.currentTier,
          status: result.tier!.status,
          benefits: result.tier!.benefits,
        },
      },
      `Supplier tier assigned to ${tier}`
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      sendError(res, error.errors[0]?.message || 'Invalid request', 400);
      return;
    }
    next(error);
  }
};

/**
 * GET /supplier/kyc-tier
 * Get supplier's own tier information
 */
export const getMyTier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Supplier access required', 403);
      return;
    }

    const supplierId = new mongoose.Types.ObjectId(currentUser.id);
    const tierRecord = await getSupplierTier(supplierId);
    const kyc = await SupplierKYC.findOne({ supplierId });

    // Check eligibility for all tiers
    const tier1Check = await checkTierRequirements(supplierId, 'tier1');
    const tier2Check = await checkTierRequirements(supplierId, 'tier2');
    const tier3Check = await checkTierRequirements(supplierId, 'tier3');

    sendSuccess(res, {
      tier: tierRecord
        ? {
            currentTier: tierRecord.currentTier,
            status: tierRecord.status,
            assignedAt: tierRecord.assignedAt,
            benefits: tierRecord.benefits,
            requirements: tierRecord.requirements,
          }
        : null,
      kycStatus: kyc?.status || 'not_submitted',
      eligibleTiers: {
        tier1: tier1Check.eligible,
        tier2: tier2Check.eligible,
        tier3: tier3Check.eligible,
      },
      canUpgrade: {
        tier2: tier2Check.eligible && (!tierRecord || tierRecord.currentTier === 'tier1'),
        tier3: tier3Check.eligible && (!tierRecord || (tierRecord.currentTier !== 'tier3')),
      },
      missingRequirements: {
        tier1: tier1Check.missingRequirements,
        tier2: tier2Check.missingRequirements,
        tier3: tier3Check.missingRequirements,
      },
      tierDefinitions: TIER_DEFINITIONS,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /supplier/kyc-tier/request-upgrade
 * Request tier upgrade (Supplier can request, admin must approve)
 */
export const requestTierUpgrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'supplier') {
      sendError(res, 'Supplier access required', 403);
      return;
    }

    const { tier } = req.body;
    if (!tier || !['tier2', 'tier3'].includes(tier)) {
      sendError(res, 'Invalid tier. Must be tier2 or tier3', 400);
      return;
    }

    const supplierId = new mongoose.Types.ObjectId(currentUser.id);
    const currentTierRecord = await getSupplierTier(supplierId);

    if (!currentTierRecord) {
      sendError(res, 'No tier assigned. Please contact admin for initial tier assignment.', 400);
      return;
    }

    // Check if upgrade is valid
    const currentTierLevel = currentTierRecord.currentTier === 'tier1' ? 1 : currentTierRecord.currentTier === 'tier2' ? 2 : 3;
    const requestedTierLevel = tier === 'tier2' ? 2 : 3;

    if (requestedTierLevel <= currentTierLevel) {
      sendError(res, 'Cannot upgrade to same or lower tier', 400);
      return;
    }

    // Check requirements
    const requirementsCheck = await checkTierRequirements(supplierId, tier as KYCTier);
    if (!requirementsCheck.eligible) {
      sendError(
        res,
        `You do not meet requirements for ${tier}. Missing: ${requirementsCheck.missingRequirements.join(', ')}`,
        400
      );
      return;
    }

    // In a real system, this would create a tier upgrade request
    // For now, we'll just return success and note that admin approval is needed
    sendSuccess(
      res,
      {
        message: 'Tier upgrade request submitted. Admin approval required.',
        requestedTier: tier,
        currentTier: currentTierRecord.currentTier,
      },
      'Tier upgrade request submitted'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /admin/kyc-tiers/definitions
 * Get tier definitions (for admin UI)
 */
export const getTierDefinitions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Admin access required', 403);
      return;
    }

    sendSuccess(res, {
      definitions: TIER_DEFINITIONS,
    });
  } catch (error: any) {
    next(error);
  }
};

