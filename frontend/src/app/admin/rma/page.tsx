'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { rmaAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RMA {
  _id: string;
  rmaId: string;
  orderId: string;
  storeId: string;
  customerId: string;
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
    reason: string;
  }>;
  requestedAt: string;
  status: 'submitted' | 'approved' | 'declined' | 'received' | 'refunded';
  returnFee: number;
  notes: string[];
  auditLog: Array<{
    action: string;
    status: string;
    note?: string;
    timestamp: string;
    userId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const RMAStatusBadge: React.FC<{ status: RMA['status'] }> = ({ status }) => {
  const variants = {
    submitted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-blue-100 text-blue-800 border-blue-200',
    declined: 'bg-red-100 text-red-800 border-red-200',
    received: 'bg-purple-100 text-purple-800 border-purple-200',
    refunded: 'bg-green-100 text-green-800 border-green-200',
  };

  const labels = {
    submitted: 'Submitted',
    approved: 'Approved',
    declined: 'Declined',
    received: 'Received',
    refunded: 'Refunded',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
        variants[status]
      )}
    >
      {labels[status]}
    </span>
  );
};

export default function AdminRMAPage() {
  const [rmas, setRmas] = useState<RMA[]>([]);
  const [selectedRMA, setSelectedRMA] = useState<RMA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '' as '' | RMA['status'],
  });
  const [approveNote, setApproveNote] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRMAs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (filters.status) params.status = filters.status;

      const response = await rmaAPI.getAll(params);
      if (response.success) {
        setRmas(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch RMAs');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching RMAs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRMAs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status]);

  const handleApprove = async (rmaId: string) => {
    try {
      setProcessing(rmaId);
      setError(null);

      const response = await rmaAPI.approve(rmaId, approveNote || undefined);
      if (response.success) {
        setApproveNote('');
        await fetchRMAs();
        if (selectedRMA?.rmaId === rmaId) {
          setSelectedRMA(response.data);
        }
      } else {
        setError(response.message || 'Failed to approve RMA');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while approving the RMA');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (rmaId: string) => {
    if (!declineNote.trim()) {
      setError('Please provide a reason for declining');
      return;
    }

    try {
      setProcessing(rmaId);
      setError(null);

      const response = await rmaAPI.decline(rmaId, declineNote);
      if (response.success) {
        setDeclineNote('');
        await fetchRMAs();
        if (selectedRMA?.rmaId === rmaId) {
          setSelectedRMA(response.data);
        }
      } else {
        setError(response.message || 'Failed to decline RMA');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while declining the RMA');
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <SectionTitle>RMA Management</SectionTitle>
          <p className="text-gray-600 mt-2">Review and manage return requests</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RMA List */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Return Requests</CardTitle>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value as typeof filters.status })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                    <option value="received">Received</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading RMAs...</p>
                  </div>
                ) : rmas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No RMAs found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rmas.map((rma) => (
                      <div
                        key={rma._id}
                        className={cn(
                          'p-4 border-2 rounded-lg cursor-pointer transition-colors',
                          selectedRMA?._id === rma._id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => setSelectedRMA(rma)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{rma.rmaId}</h3>
                            <p className="text-sm text-gray-500">Order: {rma.orderId}</p>
                            <p className="text-sm text-gray-500">
                              Customer: {rma.customerId.substring(0, 12)}...
                            </p>
                          </div>
                          <RMAStatusBadge status={rma.status} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            {rma.items.length} item(s) • {formatCurrency(rma.returnFee)} fee
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(rma.requestedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RMA Detail */}
          <div className="lg:col-span-1">
            {selectedRMA ? (
              <Card>
                <CardHeader>
                  <CardTitle>RMA Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">RMA ID</p>
                      <p className="text-sm font-mono text-gray-900">{selectedRMA.rmaId}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700">Order ID</p>
                      <p className="text-sm text-gray-900">{selectedRMA.orderId}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700">Status</p>
                      <RMAStatusBadge status={selectedRMA.status} />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700">Return Fee</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(selectedRMA.returnFee)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                      <div className="space-y-2">
                        {selectedRMA.items.map((item, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded-md text-sm">
                            <p className="font-medium">SKU: {item.sku}</p>
                            <p className="text-gray-600">Quantity: {item.quantity}</p>
                            <p className="text-gray-600">Reason: {item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedRMA.notes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                        <div className="space-y-1">
                          {selectedRMA.notes.map((note, index) => (
                            <p key={index} className="text-sm text-gray-600">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRMA.auditLog && selectedRMA.auditLog.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Audit Log</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {selectedRMA.auditLog.map((log, index) => (
                            <div key={index} className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                              <p className="font-medium">{log.action}</p>
                              <p>{log.status}</p>
                              {log.note && <p className="mt-1">{log.note}</p>}
                              <p className="mt-1">{formatDate(log.timestamp)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRMA.status === 'submitted' && (
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Approval Note (optional)
                          </label>
                          <textarea
                            value={approveNote}
                            onChange={(e) => setApproveNote(e.target.value)}
                            placeholder="Add a note when approving"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <Button
                          onClick={() => handleApprove(selectedRMA.rmaId)}
                          disabled={processing === selectedRMA.rmaId}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {processing === selectedRMA.rmaId ? 'Processing...' : 'Approve'}
                        </Button>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Decline Reason *
                          </label>
                          <textarea
                            value={declineNote}
                            onChange={(e) => setDeclineNote(e.target.value)}
                            placeholder="Required: Explain why this RMA is being declined"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            required
                          />
                        </div>
                        <Button
                          onClick={() => handleDecline(selectedRMA.rmaId)}
                          disabled={processing === selectedRMA.rmaId || !declineNote.trim()}
                          className="w-full bg-red-600 hover:bg-red-700"
                        >
                          {processing === selectedRMA.rmaId ? 'Processing...' : 'Decline'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">Select an RMA to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

