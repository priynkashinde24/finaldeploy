/**
 * Console error handler to catch and handle Next.js router errors
 * This prevents the error: h.isNextRouterError)(t[0]) || _.apply(window.console, t)
 */

/**
 * Initialize the console error handler
 * This function sets up error handling for Next.js router errors
 */
export function initializeConsoleErrorHandler(): void {
  if (typeof window === 'undefined') {
    return;
  }
  // Ensure console object exists and has all methods
  if (!window.console) {
    (window as any).console = {};
  }

  // Ensure all console methods exist
  const consoleMethods = ['log', 'error', 'warn', 'info', 'debug', 'trace'];
  consoleMethods.forEach((method) => {
    if (!console[method as keyof Console]) {
      (console as any)[method] = () => {};
    }
  });

  // Store original console methods safely
  const originalConsole: Partial<Console> = {};
  consoleMethods.forEach((method) => {
    try {
      const originalMethod = (console as any)[method];
      if (typeof originalMethod === 'function') {
        originalConsole[method as keyof Console] = originalMethod.bind(console) as any;
      }
    } catch (e) {
      // If binding fails, use no-op with proper type casting
      (originalConsole as any)[method] = (...args: any[]) => {};
    }
  });

  // Override console.error to catch Next.js router errors
  const originalError = originalConsole.error || console.error?.bind(console) || (() => {});
  console.error = function(...args: any[]) {
    try {
      // Check if this is a Next.js router error
      const firstArg = args[0];
      const errorString = 
        (typeof firstArg === 'string' ? firstArg : '') ||
        (firstArg?.toString?.() || '') ||
        (firstArg?.message || '') ||
        '';
      
      // Check all args for error patterns
      const allArgsString = args.map(arg => 
        typeof arg === 'string' ? arg : 
        (arg?.toString?.() || '') || 
        (arg?.message || '')
      ).join(' ');
      
      const combinedErrorString = errorString + ' ' + allArgsString;
      
      // Check for minified Next.js router errors (e.g., "h.isNextRouterError)(t[0]) || _.apply(window.console, t)")
      const isMinifiedRouterError = 
        combinedErrorString.includes('isNextRouterError') ||
        combinedErrorString.includes('apply(window.console') ||
        combinedErrorString.match(/isNextRouterError\)/) ||
        combinedErrorString.match(/\.isNextRouterError\)/);
      
      if (
        errorString.includes('isNextRouterError') ||
        errorString.includes('NEXT_REDIRECT') ||
        errorString.includes('NEXT_NOT_FOUND') ||
        combinedErrorString.includes('.apply(window.console') ||
        combinedErrorString.includes('apply(window.console') ||
        (errorString.includes('router') && errorString.includes('error')) ||
        isMinifiedRouterError
      ) {
        // Silently handle router errors - they're usually intentional redirects
        // Also handle minified Next.js console.apply errors
        return;
      }
      
      // Call original console.error for other errors
      if (typeof originalError === 'function') {
        try {
          originalError.apply(console, args);
        } catch (applyError) {
          // If apply fails (e.g., window.console is undefined), silently fail
          // This prevents the error from propagating
        }
      }
    } catch (e) {
      // If console.error itself fails, silently fail
      // This prevents the error from propagating
    }
  };

  // Handle unhandled errors
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || event.error?.message || event.error?.toString() || '';
    // Check for minified Next.js router errors
    const isMinifiedRouterError = 
      errorMessage.includes('isNextRouterError') ||
      errorMessage.includes('apply(window.console') ||
      errorMessage.match(/isNextRouterError\)/) ||
      errorMessage.match(/\.isNextRouterError\)/);
    
    if (
      errorMessage.includes('isNextRouterError') ||
      errorMessage.includes('NEXT_REDIRECT') ||
      errorMessage.includes('NEXT_NOT_FOUND') ||
      errorMessage.includes('.apply(window.console') ||
      errorMessage.includes('apply(window.console') ||
      (errorMessage.includes('router') && errorMessage.includes('error')) ||
      isMinifiedRouterError
    ) {
      // Prevent default error handling for router errors and console.apply errors
      event.preventDefault();
      return false;
    }
  }, true); // Use capture phase

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = 
      event.reason?.message || 
      event.reason?.toString() || 
      String(event.reason) || 
      '';
    
    // Check for minified Next.js router errors
    const isMinifiedRouterError = 
      errorMessage.includes('isNextRouterError') ||
      errorMessage.includes('apply(window.console') ||
      errorMessage.match(/isNextRouterError\)/) ||
      errorMessage.match(/\.isNextRouterError\)/);
    
    if (
      errorMessage.includes('isNextRouterError') ||
      errorMessage.includes('NEXT_REDIRECT') ||
      errorMessage.includes('NEXT_NOT_FOUND') ||
      errorMessage.includes('.apply(window.console') ||
      errorMessage.includes('apply(window.console') ||
      (errorMessage.includes('router') && errorMessage.includes('error')) ||
      isMinifiedRouterError
    ) {
      // Prevent default error handling for router errors and console.apply errors
      event.preventDefault();
      return false;
    }
  });
}

// Auto-initialize when module is imported (side effect)
if (typeof window !== 'undefined') {
  initializeConsoleErrorHandler();
}

