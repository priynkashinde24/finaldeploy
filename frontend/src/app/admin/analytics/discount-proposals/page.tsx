'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { discountProposalAPI } from '@/lib/api';

interface DiscountProposal {
  _id: string;
  skuId: {
    _id: string;
    sku: string;
  };
  productId: {
    _id: string;
    name: string;
  };
  deadStockAlertId: {
    severity: 'warning' | 'critical';
    daysSinceLastSale: number;
    stockLevel: number;
  };
  currentPrice: number;
  proposedPrice: number;
  discountPercent: number;
  discountAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'applied';
  reason: string;
  expectedImpact: {
    revenueLoss: number;
    expectedSalesIncrease: number;
    breakEvenDays: number;
  };
  proposedAt: string;
  expiresAt: string;
}

interface DiscountMetrics {
  pendingCount: number;
  approvedCount: number;
  totalPotentialRevenueLoss: number;
}

export default function AdminDiscountProposalsPage() {
  const [proposals, setProposals] = useState<DiscountProposal[]>([]);
  const [metrics, setMetrics] = useState<DiscountMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedProposal, setSelectedProposal] = useState<DiscountProposal | null>(null);

  useEffect(() => {
    fetchProposals();
  }, [statusFilter]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await discountProposalAPI.getProposals({ status: statusFilter });
      if (response.success) {
        setProposals(response.data.proposals || []);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load discount proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (proposalId: string) => {
    try {
      await discountProposalAPI.approveProposal(proposalId);
      await fetchProposals();
      setSelectedProposal(null);
      alert('Proposal approved successfully');
    } catch (err: any) {
      alert('Failed to approve proposal: ' + err.message);
    }
  };

  const handleReject = async (proposalId: string, reason?: string) => {
    try {
      const rejectionReason = reason || prompt('Enter rejection reason:') || 'Rejected by user';
      await discountProposalAPI.rejectProposal(proposalId, rejectionReason);
      await fetchProposals();
      setSelectedProposal(null);
      alert('Proposal rejected successfully');
    } catch (err: any) {
      alert('Failed to reject proposal: ' + err.message);
    }
  };

  const handleGenerate = async () => {
    try {
      const response = await discountProposalAPI.generateProposals();
      if (response.success) {
        alert(`Generated ${response.data.generated} proposals`);
        await fetchProposals();
      }
    } catch (err: any) {
      alert('Failed to generate proposals: ' + err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pending</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Rejected</span>;
      case 'expired':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Expired</span>;
      case 'applied':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Applied</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">{status}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Discount Proposals</h1>
        <Button onClick={handleGenerate} className="bg-blue-500">
          Generate Proposals
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Pending Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Approved Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.approvedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Potential Revenue Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalPotentialRevenueLoss)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="applied">Applied</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Table */}
      {loading ? (
        <div className="text-center py-8">Loading proposals...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No discount proposals found</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Discount Proposals ({proposals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">SKU</th>
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Current Price</th>
                    <th className="text-right p-2">Proposed Price</th>
                    <th className="text-right p-2">Discount</th>
                    <th className="text-right p-2">Revenue Loss</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((proposal) => (
                    <tr key={proposal._id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-sm">{proposal.skuId?.sku || 'N/A'}</td>
                      <td className="p-2">{proposal.productId?.name || 'N/A'}</td>
                      <td className="p-2 text-right">{formatCurrency(proposal.currentPrice)}</td>
                      <td className="p-2 text-right font-semibold text-green-600">
                        {formatCurrency(proposal.proposedPrice)}
                      </td>
                      <td className="p-2 text-right font-semibold text-red-600">
                        {proposal.discountPercent.toFixed(1)}%
                      </td>
                      <td className="p-2 text-right">{formatCurrency(proposal.expectedImpact.revenueLoss)}</td>
                      <td className="p-2">{getStatusBadge(proposal.status)}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setSelectedProposal(proposal)}
                            className="text-xs"
                          >
                            View
                          </Button>
                          {proposal.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(proposal._id)}
                                className="text-xs bg-green-500"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleReject(proposal._id)}
                                className="text-xs bg-red-500"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proposal Detail Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Proposal Details</CardTitle>
                <Button onClick={() => setSelectedProposal(null)}>Close</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold">SKU Information</h3>
                <p className="text-sm text-gray-600">SKU: {selectedProposal.skuId?.sku}</p>
                <p className="text-sm text-gray-600">Product: {selectedProposal.productId?.name}</p>
              </div>

              <div>
                <h3 className="font-semibold">Pricing</h3>
                <p className="text-sm">Current Price: {formatCurrency(selectedProposal.currentPrice)}</p>
                <p className="text-sm font-semibold text-green-600">
                  Proposed Price: {formatCurrency(selectedProposal.proposedPrice)}
                </p>
                <p className="text-sm text-red-600">
                  Discount: {selectedProposal.discountPercent.toFixed(1)}% ({formatCurrency(selectedProposal.discountAmount)})
                </p>
              </div>

              <div>
                <h3 className="font-semibold">Expected Impact</h3>
                <p className="text-sm">Revenue Loss: {formatCurrency(selectedProposal.expectedImpact.revenueLoss)}</p>
                <p className="text-sm">
                  Expected Sales Increase: {selectedProposal.expectedImpact.expectedSalesIncrease.toFixed(1)}%
                </p>
                <p className="text-sm">Break-Even Days: {selectedProposal.expectedImpact.breakEvenDays}</p>
              </div>

              <div>
                <h3 className="font-semibold">Alert Details</h3>
                <p className="text-sm">
                  Days Since Last Sale: {selectedProposal.deadStockAlertId?.daysSinceLastSale || 'N/A'}
                </p>
                <p className="text-sm">Stock Level: {selectedProposal.deadStockAlertId?.stockLevel || 'N/A'}</p>
                <p className="text-sm">Severity: {selectedProposal.deadStockAlertId?.severity || 'N/A'}</p>
              </div>

              <div>
                <h3 className="font-semibold">Reason</h3>
                <p className="text-sm text-gray-600">{selectedProposal.reason}</p>
              </div>

              {selectedProposal.status === 'pending' && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApprove(selectedProposal._id)} className="bg-green-500">
                    Approve
                  </Button>
                  <Button onClick={() => handleReject(selectedProposal._id)} className="bg-red-500">
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

