/**
 * Multi-Tenant Migration Script
 * 
 * PURPOSE:
 * - Migrate existing data to multi-tenant architecture
 * - Create default store for existing data
 * - Backfill storeId on all documents
 * - Enforce required constraint after migration
 * 
 * USAGE:
 *   npx ts-node scripts/migrate-to-multi-tenant.ts
 * 
 * WARNING:
 * - This script modifies your database
 * - Backup your database before running
 * - Run in development/staging first
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import { Store } from '../src/models/Store';
import { Product } from '../src/models/Product';
import { ProductVariant } from '../src/models/ProductVariant';
import { SupplierProduct } from '../src/models/SupplierProduct';
import { ResellerProduct } from '../src/models/ResellerProduct';
import { Order } from '../src/models/Order';
import { Coupon } from '../src/models/Coupon';
import { Promotion } from '../src/models/Promotion';
import { PricingRule } from '../src/models/PricingRule';
import { MarkupRule } from '../src/models/MarkupRule';
import { Subscription } from '../src/models/Subscription';
import { User } from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

interface MigrationStats {
  defaultStoreId: string | null;
  productsUpdated: number;
  variantsUpdated: number;
  supplierProductsUpdated: number;
  resellerProductsUpdated: number;
  ordersUpdated: number;
  couponsUpdated: number;
  promotionsUpdated: number;
  pricingRulesUpdated: number;
  markupRulesUpdated: number;
  subscriptionsUpdated: number;
  errors: string[];
}

async function migrateToMultiTenant(): Promise<void> {
  console.log('🚀 Starting Multi-Tenant Migration...\n');

  const stats: MigrationStats = {
    defaultStoreId: null,
    productsUpdated: 0,
    variantsUpdated: 0,
    supplierProductsUpdated: 0,
    resellerProductsUpdated: 0,
    ordersUpdated: 0,
    couponsUpdated: 0,
    promotionsUpdated: 0,
    pricingRulesUpdated: 0,
    markupRulesUpdated: 0,
    subscriptionsUpdated: 0,
    errors: [],
  };

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Create default store
    console.log('📦 Step 1: Creating default store...');
    let defaultStore = await Store.findOne({ slug: 'default' });
    
    if (!defaultStore) {
      // Find first admin user to be owner
      const adminUser = await User.findOne({ role: 'admin' });
      const ownerId = adminUser?._id.toString() || 'system';

      defaultStore = new Store({
        name: 'Default Store',
        code: 'DEFAULT',
        slug: 'default',
        subdomain: 'default',
        ownerId: ownerId,
        ownerType: 'admin',
        status: 'active',
        themeId: 'default',
        description: 'Default store for existing data migration',
      });

      await defaultStore.save();
      console.log(`✅ Created default store: ${defaultStore._id.toString()}`);
    } else {
      console.log(`✅ Default store already exists: ${defaultStore._id.toString()}`);
    }

    stats.defaultStoreId = defaultStore._id.toString();
    const defaultStoreId = defaultStore._id;

    // Step 2: Backfill storeId on all models
    console.log('\n📦 Step 2: Backfilling storeId on all documents...\n');

    // Products
    try {
      const productResult = await Product.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.productsUpdated = productResult.modifiedCount;
      console.log(`✅ Products: ${stats.productsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Products: ${error.message}`);
      console.error(`❌ Products error: ${error.message}`);
    }

    // Product Variants
    try {
      const variantResult = await ProductVariant.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.variantsUpdated = variantResult.modifiedCount;
      console.log(`✅ Product Variants: ${stats.variantsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Product Variants: ${error.message}`);
      console.error(`❌ Product Variants error: ${error.message}`);
    }

    // Supplier Products
    try {
      const supplierProductResult = await SupplierProduct.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.supplierProductsUpdated = supplierProductResult.modifiedCount;
      console.log(`✅ Supplier Products: ${stats.supplierProductsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Supplier Products: ${error.message}`);
      console.error(`❌ Supplier Products error: ${error.message}`);
    }

    // Reseller Products
    try {
      const resellerProductResult = await ResellerProduct.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.resellerProductsUpdated = resellerProductResult.modifiedCount;
      console.log(`✅ Reseller Products: ${stats.resellerProductsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Reseller Products: ${error.message}`);
      console.error(`❌ Reseller Products error: ${error.message}`);
    }

    // Orders (convert string storeId to ObjectId if needed)
    try {
      // First, update orders with string storeId to ObjectId
      const ordersWithStringStoreId = await Order.find({
        storeId: { $type: 'string' },
      });

      for (const order of ordersWithStringStoreId) {
        if (typeof order.storeId === 'string') {
          order.storeId = new mongoose.Types.ObjectId(order.storeId);
          await order.save();
        }
      }

      // Then, update orders without storeId
      const orderResult = await Order.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.ordersUpdated = orderResult.modifiedCount;
      console.log(`✅ Orders: ${stats.ordersUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Orders: ${error.message}`);
      console.error(`❌ Orders error: ${error.message}`);
    }

    // Coupons
    try {
      const couponResult = await Coupon.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.couponsUpdated = couponResult.modifiedCount;
      console.log(`✅ Coupons: ${stats.couponsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Coupons: ${error.message}`);
      console.error(`❌ Coupons error: ${error.message}`);
    }

    // Promotions
    try {
      const promotionResult = await Promotion.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.promotionsUpdated = promotionResult.modifiedCount;
      console.log(`✅ Promotions: ${stats.promotionsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Promotions: ${error.message}`);
      console.error(`❌ Promotions error: ${error.message}`);
    }

    // Pricing Rules
    try {
      const pricingRuleResult = await PricingRule.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.pricingRulesUpdated = pricingRuleResult.modifiedCount;
      console.log(`✅ Pricing Rules: ${stats.pricingRulesUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Pricing Rules: ${error.message}`);
      console.error(`❌ Pricing Rules error: ${error.message}`);
    }

    // Markup Rules
    try {
      const markupRuleResult = await MarkupRule.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.markupRulesUpdated = markupRuleResult.modifiedCount;
      console.log(`✅ Markup Rules: ${stats.markupRulesUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Markup Rules: ${error.message}`);
      console.error(`❌ Markup Rules error: ${error.message}`);
    }

    // Subscriptions
    try {
      const subscriptionResult = await Subscription.updateMany(
        { storeId: { $exists: false } },
        { $set: { storeId: defaultStoreId } }
      );
      stats.subscriptionsUpdated = subscriptionResult.modifiedCount;
      console.log(`✅ Subscriptions: ${stats.subscriptionsUpdated} updated`);
    } catch (error: any) {
      stats.errors.push(`Subscriptions: ${error.message}`);
      console.error(`❌ Subscriptions error: ${error.message}`);
    }

    // Step 3: Verify migration
    console.log('\n📦 Step 3: Verifying migration...\n');

    const productsWithoutStoreId = await Product.countDocuments({ storeId: { $exists: false } });
    const ordersWithoutStoreId = await Order.countDocuments({ storeId: { $exists: false } });

    if (productsWithoutStoreId > 0 || ordersWithoutStoreId > 0) {
      console.warn(`⚠️  Warning: Some documents still missing storeId`);
      console.warn(`   Products: ${productsWithoutStoreId}`);
      console.warn(`   Orders: ${ordersWithoutStoreId}`);
    } else {
      console.log('✅ All documents have storeId');
    }

    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('===================');
    console.log(`Default Store ID: ${stats.defaultStoreId}`);
    console.log(`Products: ${stats.productsUpdated}`);
    console.log(`Variants: ${stats.variantsUpdated}`);
    console.log(`Supplier Products: ${stats.supplierProductsUpdated}`);
    console.log(`Reseller Products: ${stats.resellerProductsUpdated}`);
    console.log(`Orders: ${stats.ordersUpdated}`);
    console.log(`Coupons: ${stats.couponsUpdated}`);
    console.log(`Promotions: ${stats.promotionsUpdated}`);
    console.log(`Pricing Rules: ${stats.pricingRulesUpdated}`);
    console.log(`Markup Rules: ${stats.markupRulesUpdated}`);
    console.log(`Subscriptions: ${stats.subscriptionsUpdated}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach((error) => console.log(`   - ${error}`));
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

    console.log('\n⚠️  IMPORTANT: After migration, enforce required storeId constraint in your models.');
    console.log('   All new documents will require storeId going forward.\n');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateToMultiTenant()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateToMultiTenant };

