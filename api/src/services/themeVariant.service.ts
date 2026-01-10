import { ThemeVariant, IThemeVariant } from '../models/ThemeVariant';
import { AuditActions } from '../constants/domain';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';

const DEFAULT_VARIANTS = [
  {
    name: 'Classic',
    code: 'classic',
    layout: { headerStyle: 'left', footerStyle: 'extended', gridDensity: 'comfortable' },
    components: { buttonStyle: 'rounded', cardStyle: 'flat', inputStyle: 'outline' },
    spacing: { baseSpacing: 12 },
    animations: { enabled: true, intensity: 'low' },
  },
  {
    name: 'Modern',
    code: 'modern',
    layout: { headerStyle: 'centered', footerStyle: 'simple', gridDensity: 'comfortable' },
    components: { buttonStyle: 'pill', cardStyle: 'elevated', inputStyle: 'outline' },
    spacing: { baseSpacing: 14 },
    animations: { enabled: true, intensity: 'medium' },
  },
  {
    name: 'Compact',
    code: 'compact',
    layout: { headerStyle: 'left', footerStyle: 'simple', gridDensity: 'compact' },
    components: { buttonStyle: 'square', cardStyle: 'flat', inputStyle: 'filled' },
    spacing: { baseSpacing: 10 },
    animations: { enabled: true, intensity: 'low' },
  },
];

async function seedDefaultVariants(storeId: string, session?: mongoose.ClientSession) {
  const existing = await ThemeVariant.find({ storeId }).session(session || null);
  if (existing.length > 0) return;
  const docs = DEFAULT_VARIANTS.map((v) => ({
    ...v,
    storeId,
    isActive: v.code === 'classic',
    version: v.code === 'classic' ? 1 : 0,
  }));
  await ThemeVariant.insertMany(docs, { session });
}

export async function getActiveTheme(storeId: string) {
  try {
    return await ThemeVariant.findOne({ storeId, isActive: true });
  } catch (error) {
    console.error('[THEME] Error fetching active theme:', error);
    return null; // Return null on error instead of throwing
  }
}

export async function listThemeVariants(storeId: string) {
  return ThemeVariant.find({ storeId }).sort({ version: -1, createdAt: -1 });
}

export async function getThemeHistory(storeId: string) {
  return ThemeVariant.find({ storeId }).sort({ version: -1, createdAt: -1 });
}

export async function applyThemeVariant(storeId: string, variantCode: string, actorId?: string, req?: any) {
  const session = await mongoose.startSession();
  let updated: IThemeVariant | null = null;
  try {
    await session.withTransaction(async () => {
      await seedDefaultVariants(storeId, session);
      const current = await ThemeVariant.findOne({ storeId, isActive: true }).session(session);
      const target = await ThemeVariant.findOne({ storeId, code: variantCode }).session(session);
      if (!target) {
        throw new Error('Theme variant not found');
      }
      const nextVersion = (current?.version || 0) + 1;
      if (current) {
        current.isActive = false;
        await current.save({ session });
      }
      target.isActive = true;
      target.version = nextVersion;
      await target.save({ session });
      updated = target;
    });
  } finally {
    await session.endSession();
  }

  const applied = updated as IThemeVariant | null;
  if (applied) {
    await logAudit({
      req,
      action: AuditActions.THEME_APPLIED,
      entityType: 'ThemeVariant',
      entityId: applied._id.toString(),
      after: applied.toObject(),
      metadata: { storeId, code: variantCode, version: applied.version, actorId },
      description: `Theme switched to ${variantCode} (v${applied.version})`,
    });
  }
  return applied;
}

export async function rollbackThemeVariant(storeId: string, version: number, actorId?: string, req?: any) {
  const session = await mongoose.startSession();
  let activated: IThemeVariant | null = null;
  try {
    await session.withTransaction(async () => {
      await seedDefaultVariants(storeId, session);
      const current = await ThemeVariant.findOne({ storeId, isActive: true }).session(session);
      const target = await ThemeVariant.findOne({ storeId, version }).session(session);
      if (!target) {
        throw new Error('Theme version not found');
      }
      const nextVersion = (current?.version || 0) + 1;
      if (current) {
        current.isActive = false;
        await current.save({ session });
      }
      target.isActive = true;
      target.version = nextVersion;
      await target.save({ session });
      activated = target;
    });
  } finally {
    await session.endSession();
  }

  const rolled = activated as IThemeVariant | null;
  if (rolled) {
    await logAudit({
      req,
      action: AuditActions.THEME_ROLLED_BACK,
      entityType: 'ThemeVariant',
      entityId: rolled._id.toString(),
      after: rolled.toObject(),
      metadata: { storeId, version: rolled.version, rolledBackTo: version, actorId },
      description: `Theme rolled back to version ${version} (new v${rolled.version})`,
    });
  }
  return rolled;
}

export async function ensureDefaultThemeVariants(storeId: string) {
  await seedDefaultVariants(storeId);
}


