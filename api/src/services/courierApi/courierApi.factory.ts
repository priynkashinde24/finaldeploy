import { CourierApiClient, CourierApiConfig } from './courierApi.types';
import { ShiprocketClient } from './shiprocket.client';
import { DelhiveryClient } from './delhivery.client';

/**
 * Courier API Factory
 * 
 * PURPOSE:
 * - Create appropriate courier API client based on provider
 * - Centralize client creation logic
 */

export function createCourierApiClient(config: CourierApiConfig): CourierApiClient | null {
  if (!config.enabled || config.provider === 'manual') {
    return null;
  }

  switch (config.provider) {
    case 'shiprocket':
      return new ShiprocketClient(config);
    case 'delhivery':
      return new DelhiveryClient(config);
    default:
      console.warn(`[COURIER API] Unknown provider: ${config.provider}`);
      return null;
  }
}

