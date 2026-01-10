import { BrandingKit } from '../models/BrandingKit';
import { AuditActions } from '../constants/domain';
import { logAudit } from '../utils/auditLogger';
import { logSecurityEvent } from '../utils/securityLogger';
import { safeDbQuery } from '../utils/safeDbQuery';
import mongoose from 'mongoose';

interface BrandingData {
  logo?: { light?: string; dark?: string; favicon?: string };
  colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  fonts?: { primaryFont?: string; secondaryFont?: string; source?: 'google' | 'custom' };
}

export async function createBrandingKit(storeId: string, data: BrandingData, actorId?: string) {
  const latest = await BrandingKit.findOne({ storeId }).sort({ version: -1 });
  const nextVersion = (latest?.version || 0) + 1;

  // deactivate existing
  if (latest) {
    latest.isActive = false;
    await latest.save();
  }

  const kit = new BrandingKit({
    storeId,
    ...data,
    version: nextVersion,
    isActive: true,
  });
  await kit.save();

  await logAudit({
    req: undefined,
    action: AuditActions.BRANDING_CREATED,
    entityType: 'BrandingKit',
    entityId: kit._id.toString(),
    after: kit.toObject(),
    description: `Branding created v${nextVersion}`,
    metadata: { storeId, version: nextVersion, actorId },
  });
  await logSecurityEvent({
    req: undefined,
    eventType: 'SUSPICIOUS_ACTIVITY', // neutral placeholder
    severity: 'low',
    metadata: { storeId, version: nextVersion, action: 'BRANDING_CREATED' },
  });

  return kit;
}

export async function updateBrandingKit(storeId: string, data: BrandingData, actorId?: string) {
  return createBrandingKit(storeId, data, actorId);
}

export async function getActiveBrandingKit(storeId: string) {
  try {
    return await safeDbQuery(
      BrandingKit.findOne({ storeId, isActive: true }).maxTimeMS(5000),
      5000,
      'Failed to fetch branding data'
    );
  } catch (error: any) {
    console.error('[BRANDING] Error fetching active branding:', error?.message || error);
    return null; // Return null on error instead of throwing
  }
}

export async function rollbackBrandingKit(storeId: string, version: number, actorId?: string) {
  const target = await BrandingKit.findOne({ storeId, version });
  if (!target) {
    throw new Error('Version not found');
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await BrandingKit.updateMany({ storeId }, { isActive: false }).session(session);
      target.isActive = true;
      await target.save({ session });
    });
  } finally {
    await session.endSession();
  }

  await logAudit({
    req: undefined,
    action: AuditActions.BRANDING_ROLLED_BACK,
    entityType: 'BrandingKit',
    entityId: target._id.toString(),
    after: target.toObject(),
    description: `Branding rolled back to v${version}`,
    metadata: { storeId, version, actorId },
  });
  return target;
}


