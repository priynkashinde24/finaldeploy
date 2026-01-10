import mongoose, { ClientSession } from 'mongoose';
import { StoreTemplate } from '../models/StoreTemplate';
import { StoreTemplateSnapshot } from '../models/StoreTemplateSnapshot';
import { Store } from '../models/Store';
import { AuditActions } from '../constants/domain';
import { logAudit } from '../utils/auditLogger';
import { logSecurityEvent } from '../utils/securityLogger';
import { createBrandingKit } from './brandingKit.service';
import { applyThemeVariant, ensureDefaultThemeVariants } from './themeVariant.service';

interface ApplyTemplateParams {
  storeId: string;
  templateId: string;
  session: ClientSession;
}

export async function applyTemplate(params: ApplyTemplateParams) {
  const { storeId, templateId, session } = params;

  // Idempotency: if snapshot exists, skip
  const existingSnapshot = await StoreTemplateSnapshot.findOne({ storeId, templateId }).session(session);
  if (existingSnapshot) {
    return existingSnapshot;
  }

  const template = await StoreTemplate.findById(templateId).session(session);
  if (!template) {
    throw new Error('Template not found');
  }
  if (template.status !== 'active') {
    throw new Error('Template is inactive');
  }

  // Apply settings to store
  const store = await Store.findById(storeId).session(session);
  if (!store) {
    throw new Error('Store not found');
  }

  // Settings
  if (template.config?.ui?.theme) {
    store.themeId = template.config.ui.theme;
  }
  // Branding defaults (optional)
  if ((template as any).config?.branding) {
    await createBrandingKit(storeId, (template as any).config.branding);
  }
  // Theme defaults
  await ensureDefaultThemeVariants(storeId);
  const themeCode = (template as any).config?.defaultThemeCode || 'classic';
  await applyThemeVariant(storeId, themeCode);
  if (template.config?.settings?.timezone) {
    (store as any).timezone = template.config.settings.timezone;
  }
  if (template.config?.settings?.currency) {
    (store as any).currency = template.config.settings.currency;
  }

  await store.save({ session });

  // TODO: pricing/markup application, features toggles, catalog seed, security defaults

  // Snapshot
  const snapshot = new StoreTemplateSnapshot({
    storeId,
    templateId,
    templateVersion: template.version,
    appliedConfig: template.toObject().config,
    appliedAt: new Date(),
  });
  await snapshot.save({ session });

  // Logs
  await logAudit({
    req: undefined,
    action: AuditActions.TEMPLATE_APPLIED,
    entityType: 'StoreTemplate',
    entityId: templateId,
    description: `Template applied to store ${storeId}`,
    metadata: {
      storeId,
      templateId,
      version: template.version,
    },
  });

  await logSecurityEvent({
    req: undefined,
    eventType: 'SUSPICIOUS_ACTIVITY', // placeholder safe event
    severity: 'low',
    metadata: { storeId, templateId, version: template.version, action: 'TEMPLATE_APPLIED' },
  });

  return snapshot;
}


