import dotenv from 'dotenv';

// Load environment variables from .env file ONLY in development/local
// On Vercel, environment variables are automatically available via process.env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import app from './app';
import { connectDB } from './config/db';
import mongoose from 'mongoose';
import { initializeCartRecoveryListeners } from './listeners/cartRecovery.listener';
import { initializeReferralRewardListeners } from './listeners/referralReward.listener';
import { initializeWhatsAppOrderNotificationListeners } from './listeners/whatsappOrderNotification.listener';
import { initializeSMSOrderNotificationListeners } from './listeners/smsOrderNotification.listener';
import { initializeOrderMessageNotificationListeners } from './listeners/orderMessageNotification.listener';
import { runGlobalAbandonedCartDetection } from './jobs/abandonedCartDetector.job';
import { runGlobalWhatsAppRecoverySender } from './jobs/whatsappRecoverySender.job';
import { runGlobalWhatsAppNotificationRetry } from './jobs/whatsappNotificationRetry.job';
import { runGlobalSMSNotificationRetry } from './jobs/smsNotificationRetry.job';
import { runHourlySnapshotGeneration, runDailySnapshotGeneration } from './jobs/salesAnalyticsSnapshot.job';
import { runHourlyConversionSnapshot, runDailyConversionSnapshot } from './jobs/conversionSnapshot.job';
import { runHourlyAOVSnapshot, runDailyAOVSnapshot } from './jobs/aovSnapshot.job';
import { runHourlySKUHeatmapSnapshot, runDailySKUHeatmapSnapshot } from './jobs/skuHeatmapSnapshot.job';
import { runDeadStockDetection } from './jobs/deadStockDetector.job';
import { runDailyInventoryAgingSnapshot } from './jobs/inventoryAgingSnapshot.job';
import { runAttributionSnapshotGeneration } from './jobs/attributionSnapshot.job';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    // Try to connect to MongoDB, but DO NOT block server startup in local dev.
    // If DB is down/misconfigured, routes will return 503 with clear messages.
    connectDB().catch((err) => {
      console.warn('[BOOT] MongoDB connection failed on startup (server will still run):', err?.message || err);
    });

    const isDbReady = () => mongoose.connection.readyState === 1;

    // Initialize event listeners
    initializeCartRecoveryListeners();
    initializeReferralRewardListeners();
    initializeWhatsAppOrderNotificationListeners();
    initializeSMSOrderNotificationListeners();
    initializeOrderMessageNotificationListeners();

    // Start abandoned cart detection cron job (every 15 minutes)
    // Note: In production, use a proper job queue (Bull, Agenda, etc.)
    if (process.env.NODE_ENV !== 'test') {
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runGlobalAbandonedCartDetection();
        } catch (error: any) {
          console.error('[ABANDONED CART DETECTOR] Cron job error:', error);
        }
      }, 15 * 60 * 1000); // 15 minutes

      // Run immediately on startup
      if (isDbReady()) {
        runGlobalAbandonedCartDetection().catch((error) => {
          console.error('[ABANDONED CART DETECTOR] Initial run error:', error);
        });
      }

      // Start WhatsApp recovery sender job (every minute)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runGlobalWhatsAppRecoverySender();
        } catch (error: any) {
          console.error('[WHATSAPP RECOVERY SENDER] Cron job error:', error);
        }
      }, 60 * 1000); // 1 minute

      // Run immediately on startup
      if (isDbReady()) {
        runGlobalWhatsAppRecoverySender().catch((error) => {
          console.error('[WHATSAPP RECOVERY SENDER] Initial run error:', error);
        });
      }

      // Start WhatsApp notification retry job (every 5 minutes)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runGlobalWhatsAppNotificationRetry();
        } catch (error: any) {
          console.error('[WHATSAPP NOTIFICATION RETRY] Cron job error:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Run immediately on startup
      if (isDbReady()) {
        runGlobalWhatsAppNotificationRetry().catch((error) => {
          console.error('[WHATSAPP NOTIFICATION RETRY] Initial run error:', error);
        });
      }

      // Start SMS notification retry job (every 5 minutes)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runGlobalSMSNotificationRetry();
        } catch (error: any) {
          console.error('[SMS NOTIFICATION RETRY] Cron job error:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Run immediately on startup
      if (isDbReady()) {
        runGlobalSMSNotificationRetry().catch((error) => {
          console.error('[SMS NOTIFICATION RETRY] Initial run error:', error);
        });
      }

      // Start sales analytics snapshot generation (hourly for today)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runHourlySnapshotGeneration();
        } catch (error: any) {
          console.error('[SALES ANALYTICS SNAPSHOT] Hourly job error:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Start sales analytics snapshot generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDailySnapshotGeneration();
        } catch (error: any) {
          console.error('[SALES ANALYTICS SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run hourly sales snapshot immediately on startup
      runHourlySnapshotGeneration().catch((error) => {
        console.error('[SALES ANALYTICS SNAPSHOT] Initial hourly run error:', error);
      });

      // Start conversion analytics snapshot generation (hourly for today)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runHourlyConversionSnapshot();
        } catch (error: any) {
          console.error('[CONVERSION SNAPSHOT] Hourly job error:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Start conversion analytics snapshot generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDailyConversionSnapshot();
        } catch (error: any) {
          console.error('[CONVERSION SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run hourly conversion snapshot immediately on startup
      runHourlyConversionSnapshot().catch((error) => {
        console.error('[CONVERSION SNAPSHOT] Initial hourly run error:', error);
      });

      // Start AOV analytics snapshot generation (hourly for today)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runHourlyAOVSnapshot();
        } catch (error: any) {
          console.error('[AOV SNAPSHOT] Hourly job error:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Start AOV analytics snapshot generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDailyAOVSnapshot();
        } catch (error: any) {
          console.error('[AOV SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run hourly AOV snapshot immediately on startup
      runHourlyAOVSnapshot().catch((error) => {
        console.error('[AOV SNAPSHOT] Initial hourly run error:', error);
      });

      // Start SKU Heatmap snapshot generation (hourly for today)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runHourlySKUHeatmapSnapshot();
        } catch (error: any) {
          console.error('[SKU HEATMAP SNAPSHOT] Hourly job error:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Start SKU Heatmap snapshot generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDailySKUHeatmapSnapshot();
        } catch (error: any) {
          console.error('[SKU HEATMAP SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run hourly SKU Heatmap snapshot immediately on startup
      runHourlySKUHeatmapSnapshot().catch((error) => {
        console.error('[SKU HEATMAP SNAPSHOT] Initial hourly run error:', error);
      });

      // Start Dead Stock Detection (daily, off-peak hours - runs at 2 AM)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDeadStockDetection();
        } catch (error: any) {
          console.error('[DEAD STOCK DETECTOR] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Start Inventory Aging Snapshot generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runDailyInventoryAgingSnapshot();
        } catch (error: any) {
          console.error('[INVENTORY AGING SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run dead stock detection immediately on startup (for testing)
      if (process.env.RUN_DEAD_STOCK_ON_STARTUP === 'true') {
        runDeadStockDetection().catch((error) => {
          console.error('[DEAD STOCK DETECTOR] Initial run error:', error);
        });
      }

      // Start Attribution Snapshot Generation (hourly for today)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          await runAttributionSnapshotGeneration();
        } catch (error: any) {
          console.error('[ATTRIBUTION SNAPSHOT] Hourly job error:', error);
        }
      }, 60 * 60 * 1000); // 1 hour

      // Start Attribution Snapshot Generation (daily for yesterday)
      setInterval(async () => {
        try {
          if (!isDbReady()) return;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          await runAttributionSnapshotGeneration({ date: yesterdayStr });
        } catch (error: any) {
          console.error('[ATTRIBUTION SNAPSHOT] Daily job error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Run hourly attribution snapshot immediately on startup
      runAttributionSnapshotGeneration().catch((error) => {
        console.error('[ATTRIBUTION SNAPSHOT] Initial hourly run error:', error);
      });
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('[CART RECOVERY] Abandoned cart detection job started (runs every 15 minutes)');
      console.log('[WHATSAPP RECOVERY] Message sender job started (runs every 1 minute)');
      console.log('[WHATSAPP NOTIFICATIONS] Retry job started (runs every 5 minutes)');
      console.log('[SMS NOTIFICATIONS] Retry job started (runs every 5 minutes)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

