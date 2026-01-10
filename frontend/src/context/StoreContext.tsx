'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Store {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  domain?: string;
  status: 'active' | 'suspended';
}

interface StoreContextType {
  store: Store | null;
  storeId: string | null;
  isLoading: boolean;
  error: string | null;
  setStore: (store: Store | null) => void;
  resolveStoreFromDomain: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
};

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * Store Provider
 * 
 * Responsibilities:
 * - Resolve store from domain/subdomain
 * - Store storeId in context
 * - Provide storeId to API layer
 * - Every API call sends x-store-id header
 */
export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const [store, setStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve store from domain/subdomain
   */
  const resolveStoreFromDomain = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const hostname = window.location.hostname;
      const parts = hostname.split('.');

      // Check if we have a subdomain (e.g., store1.yourapp.com)
      let subdomain: string | null = null;
      if (parts.length >= 3) {
        subdomain = parts[0].toLowerCase();
      }

      // Try to resolve store by subdomain or domain
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      
      // First, try to get store from localStorage (if previously set)
      const cachedStoreId = localStorage.getItem('storeId');
      if (cachedStoreId) {
        try {
          const response = await fetch(`${apiUrl}/stores/${cachedStoreId}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const storeData = await response.json();
            if (storeData.data?.store) {
              const resolvedStore = storeData.data.store;
              setStore(resolvedStore);
              setStoreId(resolvedStore._id || resolvedStore.id);
              localStorage.setItem('storeId', resolvedStore._id || resolvedStore.id);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('[STORE CONTEXT] Failed to load cached store:', err);
        }
      }

      // Try to resolve by subdomain
      if (subdomain) {
        try {
          const response = await fetch(`${apiUrl}/stores/resolve?subdomain=${subdomain}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const storeData = await response.json();
            if (storeData.data?.store) {
              const resolvedStore = storeData.data.store;
              setStore(resolvedStore);
              setStoreId(resolvedStore._id || resolvedStore.id);
              localStorage.setItem('storeId', resolvedStore._id || resolvedStore.id);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('[STORE CONTEXT] Failed to resolve by subdomain:', err);
        }
      }

      // Try to resolve by domain
      try {
        const response = await fetch(`${apiUrl}/stores/resolve?domain=${hostname}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const storeData = await response.json();
          if (storeData.data?.store) {
            const resolvedStore = storeData.data.store;
            setStore(resolvedStore);
            setStoreId(resolvedStore._id || resolvedStore.id);
            localStorage.setItem('storeId', resolvedStore._id || resolvedStore.id);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('[STORE CONTEXT] Failed to resolve by domain:', err);
      }

      // No store found
      setError('Store not found');
      setIsLoading(false);
    } catch (err) {
      console.error('[STORE CONTEXT] Error resolving store:', err);
      setError('Failed to resolve store');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    resolveStoreFromDomain();
  }, []);

  const handleSetStore = (newStore: Store | null) => {
    setStore(newStore);
    if (newStore) {
      const id = newStore.id || (newStore as any)._id;
      setStoreId(id);
      localStorage.setItem('storeId', id);
    } else {
      setStoreId(null);
      localStorage.removeItem('storeId');
    }
  };

  return (
    <StoreContext.Provider
      value={{
        store,
        storeId,
        isLoading,
        error,
        setStore: handleSetStore,
        resolveStoreFromDomain,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

/**
 * Hook to get storeId for API calls
 * Automatically adds x-store-id header to requests
 */
export const useStoreId = (): string | null => {
  const { storeId } = useStore();
  return storeId;
};

