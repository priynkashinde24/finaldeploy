/**
 * Simple in-memory cache for published pages
 * For production, consider using Redis or a distributed cache
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached page
 */
export const getCachedPage = (storeId: string, slug: string): any | null => {
  const key = `${storeId}:${slug}`;
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
};

/**
 * Set cached page
 */
export const setCachedPage = (storeId: string, slug: string, data: any): void => {
  const key = `${storeId}:${slug}`;
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
};

/**
 * Invalidate cache for a page
 */
export const invalidatePageCache = (storeId: string, slug: string): void => {
  const key = `${storeId}:${slug}`;
  cache.delete(key);
};

/**
 * Clear all cache (useful for testing or cache reset)
 */
export const clearCache = (): void => {
  cache.clear();
};

