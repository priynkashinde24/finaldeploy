/**
 * Safe router utilities that handle errors gracefully
 * Especially important for static export mode
 */

import { useRouter as useNextRouter } from 'next/navigation';

/**
 * Safe router push that handles errors
 */
export function safeRouterPush(router: ReturnType<typeof useNextRouter>, path: string) {
  try {
    // Check if we're in static export mode
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true') {
      // Use window.location for static export
      window.location.href = path;
      return;
    }
    
    router.push(path);
  } catch (error: any) {
    // If router.push fails, fallback to window.location
    console.warn('Router.push failed, using window.location:', error);
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  }
}

/**
 * Safe router replace that handles errors
 */
export function safeRouterReplace(router: ReturnType<typeof useNextRouter>, path: string) {
  try {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true') {
      window.location.replace(path);
      return;
    }
    
    router.replace(path);
  } catch (error: any) {
    console.warn('Router.replace failed, using window.location:', error);
    if (typeof window !== 'undefined') {
      window.location.replace(path);
    }
  }
}

/**
 * Hook that provides safe router methods
 */
export function useSafeRouter() {
  const router = useNextRouter();
  
  return {
    ...router,
    push: (path: string) => safeRouterPush(router, path),
    replace: (path: string) => safeRouterReplace(router, path),
  };
}

