'use client';

import React from 'react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging
    console.error('Application error:', error);
  }, [error]);

  // Check if it's a Next.js router error
  const isRouterError = 
    error.message?.includes('NEXT_REDIRECT') ||
    error.message?.includes('router') ||
    error.name === 'NEXT_REDIRECT';

  if (isRouterError) {
    // Silently handle router errors - they're usually intentional redirects
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong!</h2>
        <p className="text-gray-400 mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-deep-red text-white rounded hover:bg-primary-deep-red/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

