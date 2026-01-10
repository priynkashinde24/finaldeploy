'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Store {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  subdomain: string;
  customDomain: string | null;
  status: string;
  createdAt: string;
}

interface StoresResponse {
  success: boolean;
  data?: {
    stores: Store[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export default function StorefrontPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStores, setTotalStores] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery]);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      if (searchQuery) params.append('search', searchQuery);

      const response = await api.get(`/storefront/stores?${params.toString()}`);
      const data: StoresResponse = response.data;

      if (data.success && data.data) {
        setStores(data.data.stores);
        setTotalPages(data.data.pagination.totalPages);
        setTotalStores(data.data.pagination.total);
      } else {
        setError(data.message || 'Failed to fetch stores');
      }
    } catch (err: any) {
      console.error('[STOREFRONT] Fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchStores();
  };

  const getStoreUrl = (store: Store) => {
    // Use custom domain if available, otherwise use subdomain
    if (store.customDomain) {
      return `https://${store.customDomain}`;
    }
    // For subdomain, use the shop route to avoid conflict with stores/[id] routes
    return `/shop/${store.subdomain}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading stores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Browse Stores</h1>
          <p className="text-text-secondary">Discover and shop from our marketplace stores ({totalStores})</p>
        </div>

        {/* Search */}
        <Card className="bg-surface border-border">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="Search stores by name, description, or subdomain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} variant="primary">
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            Error: {error}
          </div>
        )}

        {/* Stores Grid */}
        {stores.length === 0 ? (
          <Card className="bg-surface border-border">
            <CardContent className="p-12">
              <div className="text-center text-text-secondary">
                <p className="text-lg mb-2">No stores found</p>
                <p className="text-sm">Try adjusting your search or check back later.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card key={store.id} className="bg-surface border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-2">
                    {store.logoUrl ? (
                      <img
                        src={store.logoUrl}
                        alt={store.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">{store.name}</CardTitle>
                      <p className="text-text-muted text-xs mt-1">@{store.subdomain}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {store.description && (
                    <p className="text-text-secondary text-sm mb-4 line-clamp-2">{store.description}</p>
                  )}
                  <Link href={getStoreUrl(store)} target={store.customDomain ? '_blank' : '_self'}>
                    <Button variant="primary" className="w-full">
                      Visit Store
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

