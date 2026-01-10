import mongoose from 'mongoose';
import { ReturnShippingRule, IReturnShippingRule } from '../models/ReturnShippingRule';

/**
 * Return Shipping Rule Resolution Engine
 *
 * PURPOSE:
 * - Resolve which return shipping rule applies to an RMA item
 * - Enforce precedence: SKU > Category > Global
 * - Filter by reason and condition
 * - Return matched rule or fallback
 *
 * RULES:
 * - SKU rules have highest priority
 * - Category rules are fallback
 * - Global rules are final fallback
 * - Priority within scope matters
 */

export interface ResolveRuleParams {
  storeId: mongoose.Types.ObjectId | string;
  skuId?: mongoose.Types.ObjectId | string;
  categoryId?: mongoose.Types.ObjectId | string;
  reason: string;
  condition: 'sealed' | 'opened' | 'damaged';
}

export interface ResolveRuleResult {
  rule: IReturnShippingRule | null;
  matchedScope: 'sku' | 'category' | 'global' | null;
  error?: string;
}

/**
 * Scope priority: SKU (1) > Category (2) > Global (3)
 */
const SCOPE_PRIORITY: Record<string, number> = {
  sku: 1,
  category: 2,
  global: 3,
};

/**
 * Resolve return shipping rule for an RMA item
 *
 * @param params - Resolution parameters
 * @returns Matched rule or null
 */
export async function resolveReturnShippingRule(
  params: ResolveRuleParams
): Promise<ResolveRuleResult> {
  const { storeId, skuId, categoryId, reason, condition } = params;

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  try {
    // STEP 1: Fetch all active rules for this store
    const allRules = await ReturnShippingRule.find({
      storeId: storeObjId,
      isActive: true,
    }).lean();

    if (allRules.length === 0) {
      return {
        rule: null,
        matchedScope: null,
        error: 'No active return shipping rules found for store',
      };
    }

    // STEP 2: Filter rules by scope match
    const scopeMatchedRules: Array<{ rule: IReturnShippingRule; scopePriority: number }> = [];

    for (const rule of allRules) {
      let matches = false;
      let scopePriority = SCOPE_PRIORITY[rule.scope] || 999;

      if (rule.scope === 'sku' && skuId) {
        const skuObjId = typeof skuId === 'string' ? new mongoose.Types.ObjectId(skuId) : skuId;
        if (rule.skuId?.toString() === skuObjId.toString()) {
          matches = true;
        }
      } else if (rule.scope === 'category' && categoryId) {
        const catObjId =
          typeof categoryId === 'string' ? new mongoose.Types.ObjectId(categoryId) : categoryId;
        if (rule.categoryId?.toString() === catObjId.toString()) {
          matches = true;
        }
      } else if (rule.scope === 'global') {
        matches = true;
      }

      if (matches) {
        scopeMatchedRules.push({ rule, scopePriority });
      }
    }

    if (scopeMatchedRules.length === 0) {
      return {
        rule: null,
        matchedScope: null,
        error: 'No matching rules found for given scope',
      };
    }

    // STEP 3: Filter by reason and condition
    const reasonConditionMatchedRules = scopeMatchedRules.filter(({ rule }) => {
      // Check if reason matches (empty array means all reasons)
      const reasonMatches =
        rule.returnReason.length === 0 || rule.returnReason.includes(reason.toLowerCase());

      // Check if condition matches (empty array means all conditions)
      const conditionMatches =
        rule.condition.length === 0 || rule.condition.includes(condition);

      return reasonMatches && conditionMatches;
    });

    if (reasonConditionMatchedRules.length === 0) {
      // Fallback: Try without reason/condition filter
      const fallbackRules = scopeMatchedRules;
      if (fallbackRules.length === 0) {
        return {
          rule: null,
          matchedScope: null,
          error: 'No rules match the return reason and condition',
        };
      }
    }

    // STEP 4: Sort by scope priority (lower = higher priority), then by rule priority
    const finalRules = reasonConditionMatchedRules.length > 0
      ? reasonConditionMatchedRules
      : scopeMatchedRules;

    finalRules.sort((a, b) => {
      // First sort by scope priority
      if (a.scopePriority !== b.scopePriority) {
        return a.scopePriority - b.scopePriority;
      }
      // Then sort by rule priority (lower = higher priority)
      return a.rule.priority - b.rule.priority;
    });

    // STEP 5: Return the highest priority match
    const matched = finalRules[0];
    return {
      rule: matched.rule as IReturnShippingRule,
      matchedScope: matched.rule.scope as 'sku' | 'category' | 'global',
    };
  } catch (error: any) {
    return {
      rule: null,
      matchedScope: null,
      error: error.message || 'Failed to resolve return shipping rule',
    };
  }
}

/**
 * Get fallback global rule
 */
export async function getFallbackGlobalRule(
  storeId: mongoose.Types.ObjectId | string
): Promise<IReturnShippingRule | null> {
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;

  const globalRule = await ReturnShippingRule.findOne({
    storeId: storeObjId,
    scope: 'global',
    isActive: true,
  })
    .sort({ priority: 1 }) // Lowest priority number = highest priority
    .lean();

  return globalRule as IReturnShippingRule | null;
}

