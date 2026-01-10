import mongoose from 'mongoose';
import { SupplierKYCTier, ISupplierKYCTier, KYCTier, TierStatus, TIER_DEFINITIONS } from '../models/SupplierKYCTier';
import { SupplierKYC } from '../models/SupplierKYC';

/**
 * KYC Tier Service
 * 
 * PURPOSE:
 * - Manage supplier KYC tier assignments
 * - Check tier requirements
 * - Handle tier upgrades/downgrades
 * - Enforce tier-based restrictions
 */

export interface CheckTierRequirementsResult {
  eligible: boolean;
  currentTier: KYCTier | null;
  eligibleTier: KYCTier | null;
  missingRequirements: string[];
}

export interface AssignTierParams {
  supplierId: mongoose.Types.ObjectId;
  tier: KYCTier;
  assignedBy: mongoose.Types.ObjectId;
  reason?: string;
  storeId?: mongoose.Types.ObjectId;
}

/**
 * Check if supplier meets requirements for a specific tier
 */
export async function checkTierRequirements(
  supplierId: mongoose.Types.ObjectId,
  tier: KYCTier
): Promise<CheckTierRequirementsResult> {
  const kyc = await SupplierKYC.findOne({ supplierId });
  const tierDef = TIER_DEFINITIONS[tier];
  const missingRequirements: string[] = [];

  if (!kyc) {
    return {
      eligible: false,
      currentTier: null,
      eligibleTier: null,
      missingRequirements: ['KYC not submitted'],
    };
  }

  // Check document requirements
  if (tierDef.requirements.documents.panCard && !kyc.documents.panCardUrl) {
    missingRequirements.push('PAN Card document');
  }
  if (tierDef.requirements.documents.aadhaarCard && (!kyc.documents.aadhaarFrontUrl || !kyc.documents.aadhaarBackUrl)) {
    missingRequirements.push('Aadhaar Card documents');
  }
  if (tierDef.requirements.documents.gstCertificate && !kyc.documents.gstCertificateUrl) {
    missingRequirements.push('GST Certificate document');
  }

  // Check business info requirements
  if (tierDef.requirements.businessInfo.businessName && !kyc.businessName) {
    missingRequirements.push('Business Name');
  }
  if (tierDef.requirements.businessInfo.gstNumber && !kyc.gstNumber) {
    missingRequirements.push('GST Number');
  }

  // Check verification status
  if (tierDef.requirements.verification.identityVerified && kyc.status !== 'approved') {
    missingRequirements.push('Identity verification (KYC must be approved)');
  }

  // Find current tier
  const currentTierRecord = await SupplierKYCTier.findOne({ supplierId });
  const currentTier = currentTierRecord?.currentTier || null;

  // Determine highest eligible tier (simplified - just return if current tier is eligible)
  let eligibleTier: KYCTier | null = null;
  if (missingRequirements.length === 0) {
    eligibleTier = tier;
  }

  return {
    eligible: missingRequirements.length === 0,
    currentTier,
    eligibleTier,
    missingRequirements,
  };
}

/**
 * Assign tier to supplier
 */
export async function assignTier(params: AssignTierParams): Promise<{ success: boolean; tier?: ISupplierKYCTier; error?: string }> {
  const { supplierId, tier, assignedBy, reason, storeId } = params;

  try {
    // Check requirements
    const requirementsCheck = await checkTierRequirements(supplierId, tier);
    if (!requirementsCheck.eligible) {
      return {
        success: false,
        error: `Supplier does not meet requirements for ${tier}. Missing: ${requirementsCheck.missingRequirements.join(', ')}`,
      };
    }

    const tierDef = TIER_DEFINITIONS[tier];

    // Find or create tier record
    let tierRecord = await SupplierKYCTier.findOne({ supplierId });

    if (tierRecord) {
      // Update existing tier
      const previousTier = tierRecord.currentTier;
      const isUpgrade = getTierLevel(tier) > getTierLevel(previousTier);
      const isDowngrade = getTierLevel(tier) < getTierLevel(previousTier);

      // Add to history
      tierRecord.tierHistory.push({
        tier: tierRecord.currentTier,
        status: tierRecord.status,
        assignedAt: tierRecord.assignedAt,
        assignedBy: tierRecord.assignedBy,
        reason: reason || 'Tier change',
      });

      tierRecord.currentTier = tier;
      tierRecord.status = 'active';
      tierRecord.assignedBy = assignedBy;
      tierRecord.assignedAt = new Date();

      if (isUpgrade) {
        tierRecord.upgradedAt = new Date();
        tierRecord.downgradedAt = null;
      } else if (isDowngrade) {
        tierRecord.downgradedAt = new Date();
        tierRecord.upgradedAt = null;
      }

      // Update requirements and benefits
      tierRecord.requirements = tierDef.requirements;
      tierRecord.benefits = tierDef.benefits;

      if (storeId) {
        tierRecord.storeId = storeId;
      }

      await tierRecord.save();
    } else {
      // Create new tier record
      tierRecord = new SupplierKYCTier({
        storeId: storeId || new mongoose.Types.ObjectId(), // Default store if not provided
        supplierId,
        currentTier: tier,
        status: 'active',
        assignedAt: new Date(),
        assignedBy,
        tierHistory: [
          {
            tier,
            status: 'active',
            assignedAt: new Date(),
            assignedBy,
            reason: reason || 'Initial tier assignment',
          },
        ],
        requirements: tierDef.requirements,
        benefits: tierDef.benefits,
      });

      await tierRecord.save();
    }

    return {
      success: true,
      tier: tierRecord,
    };
  } catch (error: any) {
    console.error('[KYC TIER] Assign tier error:', error);
    return {
      success: false,
      error: error.message || 'Failed to assign tier',
    };
  }
}

/**
 * Get tier level number (for comparison)
 */
function getTierLevel(tier: KYCTier): number {
  const levels: Record<KYCTier, number> = {
    tier1: 1,
    tier2: 2,
    tier3: 3,
  };
  return levels[tier];
}

/**
 * Get supplier's current tier
 */
export async function getSupplierTier(supplierId: mongoose.Types.ObjectId): Promise<ISupplierKYCTier | null> {
  return await SupplierKYCTier.findOne({ supplierId });
}

/**
 * Check if supplier can process order based on tier restrictions
 */
export async function canProcessOrder(
  supplierId: mongoose.Types.ObjectId,
  orderValue: number,
  monthlyOrderCount: number
): Promise<{ allowed: boolean; reason?: string }> {
  const tierRecord = await getSupplierTier(supplierId);

  if (!tierRecord || tierRecord.status !== 'active') {
    return {
      allowed: false,
      reason: 'Supplier tier not active',
    };
  }

  const benefits = tierRecord.benefits;

  if (orderValue > benefits.maxOrderValue) {
    return {
      allowed: false,
      reason: `Order value exceeds tier limit of ${benefits.maxOrderValue}`,
    };
  }

  if (monthlyOrderCount >= benefits.maxMonthlyOrders) {
    return {
      allowed: false,
      reason: `Monthly order limit of ${benefits.maxMonthlyOrders} reached`,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * Get tier-based payout delay
 */
export async function getPayoutDelayDays(supplierId: mongoose.Types.ObjectId): Promise<number> {
  const tierRecord = await getSupplierTier(supplierId);
  return tierRecord?.benefits.payoutDelayDays || 15; // Default 15 days
}

/**
 * Get tier-based commission rate
 */
export async function getCommissionRate(supplierId: mongoose.Types.ObjectId): Promise<number> {
  const tierRecord = await getSupplierTier(supplierId);
  return tierRecord?.benefits.commissionRate || 7; // Default 7%
}

