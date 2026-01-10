'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function SupplierProductsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Products</h1>
        <p className="text-text-secondary">
          Manage your product catalog
        </p>
      </div>

      {/* Coming Soon Card */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Product Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
            <p className="text-text-secondary max-w-md mx-auto">
              Product management features are under development. You'll be able to add, edit, and manage your product catalog here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

