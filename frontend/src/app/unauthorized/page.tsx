'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <h1 className="text-4xl font-bold text-text-primary mb-4">403</h1>
          <h2 className="text-2xl font-semibold text-text-primary mb-4">Access Denied</h2>
          <p className="text-text-secondary mb-6">
            You don't have permission to access this page. Please contact an administrator if you believe this is an error.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button variant="primary">Go to Dashboard</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Go Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

