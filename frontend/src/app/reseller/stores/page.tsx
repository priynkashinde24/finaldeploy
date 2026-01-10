'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getCurrentUser } from '@/lib/auth';
import { storeAPI } from '@/lib/api';

export default function ResellerStoresPage() {
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => user?.name || user?.email || 'Reseller', [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError('Please login to view your stores.');
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const resp = await storeAPI.getByOwner(user.id);
        const list = resp?.data || [];
        setStores(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load stores');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Stores</h1>
          <p className="text-text-secondary">Manage your online stores ({title})</p>
        </div>
        <Link href="/create-store">
          <Button variant="primary">Create store</Button>
        </Link>
      </div>

      {/* Content */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Your Stores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-text-secondary">Loading stores...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : stores.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No stores yet</h3>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Create your first store to start selling.
              </p>
              <Link href="/create-store">
                <Button variant="primary">Create store</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((s: any) => (
                <div
                  key={s._id || s.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/30 p-4"
                >
                  <div>
                    <div className="text-white font-semibold">{s.name}</div>
                    <div className="text-xs text-text-muted">
                      subdomain: {s.subdomain} • status: {s.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/stores/${s._id || s.id}/preview`}>
                      <Button variant="secondary" size="sm">Preview</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

