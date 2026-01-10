'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface StagedPriceUpdate {
  _id: string;
  rowNumber: number;
  normalizedData: {
    sku: string;
    newPrice: number;
  };
  status: 'valid' | 'invalid' | 'approved' | 'rejected';
  validationErrors: Array<{ field: string; message: string }>;
  oldPrice?: number;
  supplierProductId?: {
    supplierSku: string;
    costPrice: number;
  };
}

interface PriceUpdateJob {
  _id: string;
  fileName: string;
  fileType: 'csv' | 'xlsx';
  status: 'uploaded' | 'processing' | 'validation_failed' | 'pending_approval' | 'approved' | 'rejected';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  createdAt: string;
  completedAt?: string;
}

export default function PriceUpdateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [updateJob, setUpdateJob] = useState<PriceUpdateJob | null>(null);
  const [stagedUpdates, setStagedUpdates] = useState<StagedPriceUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUpdateDetails();
  }, [jobId]);

  const loadUpdateDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/supplier/price-updates/${jobId}`);
      
      if (response.data.success) {
        setUpdateJob(response.data.data.updateJob);
        setStagedUpdates(response.data.data.stagedUpdates || []);
      } else {
        setError(response.data.message || 'Failed to load price update details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load price update details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!updateJob || updateJob.validRows === 0) {
      setError('No valid price updates to submit for approval');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/supplier/price-updates/${jobId}/submit`);
      
      if (response.data.success) {
        await loadUpdateDetails();
        alert('Price update submitted for approval successfully!');
      } else {
        setError(response.data.message || 'Failed to submit for approval');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUpdates = stagedUpdates.filter(update => {
    if (filter === 'valid') return update.status === 'valid';
    if (filter === 'invalid') return update.status === 'invalid';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading price update details...</div>
      </div>
    );
  }

  if (error && !updateJob) {
    return (
      <div className="p-6 bg-error/10 border border-error rounded-lg">
        <p className="text-error">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!updateJob) {
    return <div>Price update job not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Price Update Review</h1>
          <p className="text-textSecondary mt-1">{updateJob.fileName}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-surfaceLight text-textPrimary rounded-lg hover:bg-surfaceLight/80"
        >
          Back
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surfaceLight rounded-lg border border-border">
          <div className="text-sm text-textSecondary mb-1">Status</div>
          <div className="text-lg font-semibold text-textPrimary capitalize">{updateJob.status.replace('_', ' ')}</div>
        </div>
        <div className="p-4 bg-surfaceLight rounded-lg border border-border">
          <div className="text-sm text-textSecondary mb-1">Total Rows</div>
          <div className="text-lg font-semibold text-textPrimary">{updateJob.totalRows}</div>
        </div>
        <div className="p-4 bg-success/10 rounded-lg border border-success">
          <div className="text-sm text-textSecondary mb-1">Valid Rows</div>
          <div className="text-lg font-semibold text-success">{updateJob.validRows}</div>
        </div>
        <div className="p-4 bg-error/10 rounded-lg border border-error">
          <div className="text-sm text-textSecondary mb-1">Invalid Rows</div>
          <div className="text-lg font-semibold text-error">{updateJob.invalidRows}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-textSecondary">Filter:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          All ({stagedUpdates.length})
        </button>
        <button
          onClick={() => setFilter('valid')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'valid' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Valid ({updateJob.validRows})
        </button>
        <button
          onClick={() => setFilter('invalid')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'invalid' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Invalid ({updateJob.invalidRows})
        </button>
      </div>

      {/* Updates Table */}
      <div className="bg-surfaceLight rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Row</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Old Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">New Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Change</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Errors</th>
              </tr>
            </thead>
            <tbody>
              {filteredUpdates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-textSecondary">
                    No price updates found
                  </td>
                </tr>
              ) : (
                filteredUpdates.map((update) => {
                  const priceChange = update.oldPrice 
                    ? ((update.normalizedData.newPrice - update.oldPrice) / update.oldPrice * 100).toFixed(1)
                    : 'N/A';
                  const priceDiff = update.oldPrice 
                    ? (update.normalizedData.newPrice - update.oldPrice).toFixed(2)
                    : 'N/A';

                  return (
                    <tr key={update._id} className="border-b border-border hover:bg-surface/50">
                      <td className="px-4 py-3 text-sm text-textPrimary">{update.rowNumber}</td>
                      <td className="px-4 py-3 text-sm text-textPrimary font-mono">{update.normalizedData.sku}</td>
                      <td className="px-4 py-3 text-sm text-textPrimary">
                        {update.oldPrice ? `$${update.oldPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-textPrimary font-semibold">
                        ${update.normalizedData.newPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {priceChange !== 'N/A' && (
                          <span className={parseFloat(priceChange) >= 0 ? 'text-success' : 'text-error'}>
                            {parseFloat(priceChange) >= 0 ? '+' : ''}{priceChange}% ({priceDiff !== 'N/A' && parseFloat(priceDiff) >= 0 ? '+' : ''}${priceDiff})
                          </span>
                        )}
                        {priceChange === 'N/A' && <span className="text-textSecondary">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            update.status === 'valid'
                              ? 'bg-success/10 text-success'
                              : update.status === 'invalid'
                              ? 'bg-error/10 text-error'
                              : 'bg-textSecondary/10 text-textSecondary'
                          }`}
                        >
                          {update.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {update.validationErrors.length > 0 ? (
                          <div className="text-xs text-error">
                            {update.validationErrors.map((err, idx) => (
                              <div key={idx}>{err.message}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-textSecondary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {updateJob.status === 'pending_approval' && (
        <div className="p-4 bg-primary/10 border border-primary rounded-lg">
          <p className="text-textPrimary mb-2">This price update has been submitted for approval.</p>
          <p className="text-sm text-textSecondary">An admin will review and approve or reject it.</p>
        </div>
      )}

      {updateJob.status === 'approved' && (
        <div className="p-4 bg-success/10 border border-success rounded-lg">
          <p className="text-success font-medium">✓ This price update has been approved and prices are now live.</p>
        </div>
      )}

      {updateJob.status === 'rejected' && (
        <div className="p-4 bg-error/10 border border-error rounded-lg">
          <p className="text-error font-medium">✗ This price update has been rejected.</p>
        </div>
      )}

      {updateJob.status === 'pending_approval' && updateJob.validRows > 0 && (
        <div className="flex justify-end gap-4">
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting || updateJob.status !== 'pending_approval'}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-error/10 border border-error rounded-lg">
          <p className="text-error">{error}</p>
        </div>
      )}
    </div>
  );
}

