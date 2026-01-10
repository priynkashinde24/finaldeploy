import mongoose from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { markIdempotent, isIdempotent } from '../utils/idempotency';
import { Store } from '../models/Store';
import { StoreTemplate } from '../models/StoreTemplate';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import { logAudit } from '../utils/auditLogger';
import { logSecurityEvent } from '../utils/securityLogger';
import { AuditActions } from '../constants/domain';
import { applyTemplate } from './templateLoader.service';

interface GenerateStoreParams {
  ownerId: string;
  storeName: string;
  subdomain: string;
  planId?: string | null;
  templateId?: string | null;
}

export async function generateStore(params: GenerateStoreParams) {
  const { ownerId, storeName, subdomain, planId, templateId } = params;
  const idempotencyKey = `${ownerId}:${storeName.toLowerCase()}`;

  // If processed before, return existing store
  if (isIdempotent(idempotencyKey)) {
    const existing = await Store.findOne({ ownerId, name: storeName });
    if (existing) return existing;
  }

  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  const template = templateId ? await StoreTemplate.findById(templateId) : await StoreTemplate.findOne();

  const store = await withTransaction(async (session) => {
    // Mark idempotent
    if (!markIdempotent(idempotencyKey)) {
      const existing = await Store.findOne({ ownerId, name: storeName }).session(session);
      if (existing) return existing;
      throw new Error('Duplicate store request');
    }

    // Create store
    const code = subdomain.toUpperCase().replace(/-/g, '_');
    const newStore = new Store({
      name: storeName,
      code,
      slug: subdomain.toLowerCase(),
      subdomain: subdomain.toLowerCase(),
      ownerId,
      ownerType: 'reseller',
      status: 'active',
      themeId: template?.config?.ui?.theme || template?.config?.defaultThemeCode || 'default',
      description: template?.description || '',
    });
    await newStore.save({ session });

    // Apply template if available. In fresh/local installs there may be no templates yet;
    // in that case, keep the store usable with defaults instead of failing creation.
    if (template) {
      await applyTemplate({
        storeId: newStore._id.toString(),
        templateId: template._id.toString(),
        session,
      });
    }

    // Assign owner access
    if (!owner.accessibleStores) owner.accessibleStores = [];
    owner.accessibleStores.push(new mongoose.Types.ObjectId(newStore._id));
    owner.defaultStoreId = owner.defaultStoreId || new mongoose.Types.ObjectId(newStore._id);
    await owner.save({ session });

    // Create subscription if planId is provided.
    // In early/local setups there may be no plans yet; avoid failing store creation.
    if (planId) {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      const subscription = new Subscription({
        storeId: newStore._id,
        userId: owner._id,
        role: owner.role,
        planId,
        billingCycle: 'monthly',
        startDate: start,
        endDate: end,
        status: 'active',
        usage: {
          productsUsed: 0,
          variantsUsed: 0,
          ordersThisMonth: 0,
          lastResetDate: start,
        },
      });
      await subscription.save({ session });
    }

    // TODO: apply pricing/markup defaults, seed categories/products, init security baseline

    // Audit and security log
    await logAudit({
      req: undefined,
      action: AuditActions.STORE_CREATED,
      entityType: 'Store',
      entityId: newStore._id.toString(),
      after: newStore.toObject(),
      description: `Store created via generator`,
      metadata: {
        ownerId,
        templateId: template?._id?.toString() || null,
        planId: planId || null,
      },
    });

    await logSecurityEvent({
      req: undefined,
      eventType: 'SUSPICIOUS_ACTIVITY', // neutral placeholder; could be a specific SAFE event
      severity: 'low',
      metadata: {
        storeId: newStore._id.toString(),
        action: 'STORE_CREATED',
      },
    });

    return newStore;
  });

  return store;
}


