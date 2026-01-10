'use client';

import { useEffect } from 'react';

/**
 * Client component that initializes console error handler
 * This must be a client component to access window
 */
export function ErrorHandlerInit() {
  useEffect(() => {
    // Dynamically import and initialize the error handler
    import('@/lib/consoleErrorHandler').then((module) => {
      // Module is imported and auto-initialized
      // The import itself triggers the side effect
    });
  }, []);

  return null;
}

