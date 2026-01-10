'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getResellerPayouts, ResellerPayout } from '@/lib/payouts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function ResellerEarningsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<ResellerPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({
    totalEarnings: 0,
    totalPending: 0,
    totalPendingAmount: 0,
    totalProcessed: 0,
    totalProcessedAmount: 0,
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadPayouts();
  }, [currentUser, router]);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getResellerPayouts();

      if (response.success && response.data) {
        setPayouts(response.data);
        // Calculate totals from response if available
        // For now, calculate from payouts
        const totalEarnings = response.data.reduce((sum: number, p: ResellerPayout) => sum + p.payoutAmount, 0);
        const pendingPayouts = response.data.filter((p: ResellerPayout) => p.payoutStatus === 'pending');
        const totalPendingAmount = pendingPayouts.reduce((sum: number, p: ResellerPayout) => sum + p.payoutAmount, 0);
        const processedPayouts = response.data.filter((p: ResellerPayout) => p.payoutStatus === 'processed');
        const totalProcessedAmount = processedPayouts.reduce((sum: number, p: ResellerPayout) => sum + p.payoutAmount, 0);

        setTotals({
          totalEarnings,
          totalPending: pendingPayouts.length,
          totalPendingAmount,
          totalProcessed: processedPayouts.length,
          totalProcessedAmount,
        });
      } else {
        setError(response.message || 'Failed to load payouts');
      }
    } catch (err: any) {
      console.error('[RESELLER EARNINGS] Load error:', err);
      setError(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
      processed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Processed' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={cn('px-2 py-1 rounded text-xs font-semibold', config.bg, config.text)}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading earnings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Earnings</h1>
          <p className="text-text-secondary">View your earnings and payout history</p>
        </div>
        <Card className="bg-surface border-border">
          <CardContent className="p-6">
            <div className="text-center text-red-400">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Earnings</h1>
        <p className="text-text-secondary">View your earnings and payout history</p>
      </div>

      {/* Totals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-text-secondary">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white mb-1">₹{totals.totalEarnings.toLocaleString()}</div>
            <p className="text-xs text-text-muted">All time earnings</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-text-secondary">Pending Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              ₹{totals.totalPendingAmount.toLocaleString()}
            </div>
            <p className="text-xs text-text-muted">{totals.totalPending} pending payout(s)</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-text-secondary">Processed Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400 mb-1">
              ₹{totals.totalProcessedAmount.toLocaleString()}
            </div>
            <p className="text-xs text-text-muted">{totals.totalProcessed} processed payout(s)</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white mb-1">{payouts.length}</div>
            <p className="text-xs text-text-muted">Orders with earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Payouts Table */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Payout History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payouts.length === 0 ? (
            <div className="p-6 text-center text-text-secondary">No payouts yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1A1A1A] border-b border-[#242424]">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-text-secondary">Order ID</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-text-secondary">Order Amount</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-text-secondary">Margin Earned</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-text-secondary">Payout Status</th>
                    <th className="py-3 px-4 text-left text-sm font-semibold text-text-secondary">Payout Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="text-white font-medium text-sm">{payout.orderId}</p>
                      </td>
                      <td className="py-3 px-4 text-white">₹{payout.orderAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-green-400 font-medium">
                        ₹{payout.marginAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(payout.payoutStatus)}</td>
                      <td className="py-3 px-4 text-text-secondary text-sm">
                        {formatDate(payout.payoutDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
