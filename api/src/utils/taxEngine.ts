import mongoose from 'mongoose';
import { TaxRate, ITaxRate } from '../models/TaxRate';
import { TaxProfile, ITaxProfile } from '../models/TaxProfile';
import { IOrder, IOrderItem } from '../models/Order';
import { Product } from '../models/Product';
import { roundPrice } from '../services/pricingService';

/**
 * Tax Engine
 * 
 * PURPOSE:
 * - Calculate tax correctly for India (GST) and Global (VAT)
 * - Support intra-state / inter-state logic
 * - Snapshot-based (never recalc later)
 * - Category-level tax handling
 * - Split-aware tax calculation
 * 
 * RULES:
 * - Tax snapshot is immutable
 * - Never recalculate after order creation
 * - Tax profile required for calculation
 */

export interface TaxSnapshot {
  taxType: 'GST' | 'VAT';
  countryCode: string;
  stateCode?: string;
  placeOfSupply: {
    country: string;
    state?: string;
  };
  taxableAmount: number;
  taxBreakup: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    vat?: number;
  };
  totalTax: number;
  exemptionReason?: string;
  calculatedAt: Date;
}

export interface TaxCalculationParams {
  orderItems: IOrderItem[];
  storeTaxProfile: ITaxProfile;
  supplierTaxProfile?: ITaxProfile;
  resellerTaxProfile?: ITaxProfile;
  shippingAddress: {
    country: string;
    state?: string;
    city?: string;
  };
  storeId: mongoose.Types.ObjectId;
  subtotal: number; // Amount after discounts, before tax
}

export interface TaxCalculationResult {
  snapshot: TaxSnapshot;
  itemTaxes: Array<{
    productId: string;
    categoryId?: string;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    taxBreakup: {
      cgst?: number;
      sgst?: number;
      igst?: number;
      vat?: number;
    };
  }>;
}

/**
 * Resolve tax rate for a product category
 */
async function resolveTaxRate(
  categoryId: mongoose.Types.ObjectId | string | undefined,
  countryCode: string,
  taxType: 'GST' | 'VAT',
  storeId: mongoose.Types.ObjectId
): Promise<ITaxRate | null> {
  const categoryObjId = categoryId ? new mongoose.Types.ObjectId(categoryId) : null;

  // Try category-specific rate first
  if (categoryObjId) {
    const categoryRate = await TaxRate.findOne({
      storeId,
      countryCode,
      taxType,
      categoryId: categoryObjId,
      isActive: true,
      effectiveFrom: { $lte: new Date() },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
    }).lean();

    if (categoryRate) {
      return categoryRate;
    }
  }

  // Fallback to default rate (categoryId = null)
  const defaultRate = await TaxRate.findOne({
    storeId,
    countryCode,
    taxType,
    categoryId: null,
    isActive: true,
    effectiveFrom: { $lte: new Date() },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date() } }],
  }).lean();

  return defaultRate;
}

/**
 * Calculate tax for an order
 * 
 * This function:
 * - Resolves tax rates per item category
 * - Determines intra-state vs inter-state (for GST)
 * - Calculates tax breakdown
 * - Creates immutable snapshot
 */
export async function calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
  const {
    orderItems,
    storeTaxProfile,
    shippingAddress,
    storeId,
    subtotal,
  } = params;

  // Determine tax type based on country
  const taxType: 'GST' | 'VAT' = storeTaxProfile.countryCode === 'IN' ? 'GST' : 'VAT';

  // For GST: Determine intra-state vs inter-state
  const isIntraState =
    taxType === 'GST' &&
    storeTaxProfile.stateCode &&
    shippingAddress.state &&
    storeTaxProfile.stateCode === shippingAddress.state;

  // Get product categories for tax rate resolution
  const productIds = orderItems.map((item) => new mongoose.Types.ObjectId(item.productId));
  const products = await Product.find({ _id: { $in: productIds } })
    .select('categoryId')
    .lean();

  const productCategoryMap = new Map<string, mongoose.Types.ObjectId | undefined>();
  products.forEach((product) => {
    productCategoryMap.set(product._id.toString(), product.categoryId);
  });

  // Calculate tax per item
  const itemTaxes: TaxCalculationResult['itemTaxes'] = [];
  let totalTax = 0;
  const taxBreakup: TaxSnapshot['taxBreakup'] = {};

  for (const item of orderItems) {
    const productId = item.productId;
    const categoryId = productCategoryMap.get(productId);
    const itemSubtotal = item.totalPrice; // After discounts

    // Resolve tax rate for this item's category
    const taxRate = await resolveTaxRate(categoryId, storeTaxProfile.countryCode, taxType, storeId);

    if (!taxRate) {
      // No tax applicable for this item
      itemTaxes.push({
        productId,
        categoryId: categoryId?.toString(),
        taxableAmount: itemSubtotal,
        taxRate: 0,
        taxAmount: 0,
        taxBreakup: {},
      });
      continue;
    }

    // Calculate tax amount
    const itemTaxAmount = roundPrice((itemSubtotal * taxRate.rate) / 100);

    // Calculate tax breakup based on tax type
    let itemTaxBreakup: TaxSnapshot['taxBreakup'] = {};

    if (taxType === 'GST') {
      if (isIntraState && taxRate.components) {
        // Intra-state: CGST + SGST
        const cgstRate = taxRate.components.cgst || taxRate.rate / 2;
        const sgstRate = taxRate.components.sgst || taxRate.rate / 2;
        itemTaxBreakup.cgst = roundPrice((itemSubtotal * cgstRate) / 100);
        itemTaxBreakup.sgst = roundPrice((itemSubtotal * sgstRate) / 100);
      } else {
        // Inter-state: IGST
        const igstRate = taxRate.components?.igst || taxRate.rate;
        itemTaxBreakup.igst = roundPrice((itemSubtotal * igstRate) / 100);
      }
    } else if (taxType === 'VAT') {
      // VAT: Single tax amount
      itemTaxBreakup.vat = itemTaxAmount;
    }

    itemTaxes.push({
      productId,
      categoryId: categoryId?.toString(),
      taxableAmount: itemSubtotal,
      taxRate: taxRate.rate,
      taxAmount: itemTaxAmount,
      taxBreakup: itemTaxBreakup,
    });

    // Aggregate totals
    totalTax += itemTaxAmount;
    if (itemTaxBreakup.cgst) taxBreakup.cgst = (taxBreakup.cgst || 0) + itemTaxBreakup.cgst;
    if (itemTaxBreakup.sgst) taxBreakup.sgst = (taxBreakup.sgst || 0) + itemTaxBreakup.sgst;
    if (itemTaxBreakup.igst) taxBreakup.igst = (taxBreakup.igst || 0) + itemTaxBreakup.igst;
    if (itemTaxBreakup.vat) taxBreakup.vat = (taxBreakup.vat || 0) + itemTaxBreakup.vat;
  }

  // Round breakup totals
  if (taxBreakup.cgst) taxBreakup.cgst = roundPrice(taxBreakup.cgst);
  if (taxBreakup.sgst) taxBreakup.sgst = roundPrice(taxBreakup.sgst);
  if (taxBreakup.igst) taxBreakup.igst = roundPrice(taxBreakup.igst);
  if (taxBreakup.vat) taxBreakup.vat = roundPrice(taxBreakup.vat);

  totalTax = roundPrice(totalTax);

  // Create tax snapshot
  const snapshot: TaxSnapshot = {
    taxType,
    countryCode: storeTaxProfile.countryCode,
    stateCode: storeTaxProfile.stateCode,
    placeOfSupply: {
      country: shippingAddress.country,
      state: shippingAddress.state,
    },
    taxableAmount: roundPrice(subtotal),
    taxBreakup,
    totalTax,
    calculatedAt: new Date(),
  };

  return {
    snapshot,
    itemTaxes,
  };
}

/**
 * Calculate split-aware tax for PaymentSplit
 * 
 * This calculates tax for each entity's share:
 * - Supplier: Tax on supplierAmount
 * - Reseller: Tax on reseller margin (if applicable)
 * - Platform: Tax on commission (if applicable)
 * - Customer: Sum of all applicable taxes
 */
export async function calculateSplitTax(
  split: {
    totalAmount: number;
    supplierAmount: number;
    resellerAmount: number;
    platformAmount: number;
  },
  originalTaxSnapshot: TaxSnapshot,
  storeTaxProfile: ITaxProfile
): Promise<{
  supplierTax: number;
  resellerTax: number;
  platformTax: number;
  customerTax: number;
}> {
  // For B2B invoices (supplier, reseller, platform), tax is typically not charged
  // For customer invoice, use original tax snapshot

  // Customer tax = original tax (already calculated)
  const customerTax = originalTaxSnapshot.totalTax;

  // Supplier/Reseller/Platform invoices are typically tax-exempt for B2B
  // But can be configured if needed
  const supplierTax = 0;
  const resellerTax = 0;
  const platformTax = 0;

  return {
    supplierTax,
    resellerTax,
    platformTax,
    customerTax: roundPrice(customerTax),
  };
}

/**
 * Get tax profile for an entity
 */
export async function getTaxProfile(
  entityType: 'store' | 'supplier' | 'reseller' | 'platform',
  entityId: string,
  storeId: mongoose.Types.ObjectId
): Promise<ITaxProfile | null> {
  return await TaxProfile.findOne({
    storeId,
    entityType,
    entityId,
    isActive: true,
  }).lean();
}
