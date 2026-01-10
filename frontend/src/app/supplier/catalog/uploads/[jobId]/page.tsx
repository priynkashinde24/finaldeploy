'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface StagedProduct {
  _id: string;
  rowNumber: number;
  normalizedData: {
    productName: string;
    sku: string;
    brand?: string;
    category?: string;
    costPrice: number;
    stock: number;
    minOrderQty?: number;
    description?: string;
  };
  status: 'valid' | 'invalid' | 'approved' | 'rejected';
  validationErrors: Array<{ field: string; message: string }>;
  globalProductId?: string;
  requiresApproval: boolean;
}

interface UploadJob {
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

export default function CatalogUploadReviewPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [uploadJob, setUploadJob] = useState<UploadJob | null>(null);
  const [stagedProducts, setStagedProducts] = useState<StagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUploadDetails();
  }, [jobId]);

  const loadUploadDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/supplier/catalog/uploads/${jobId}`);
      
      if (response.data.success) {
        setUploadJob(response.data.data.uploadJob);
        setStagedProducts(response.data.data.stagedProducts || []);
      } else {
        setError(response.data.message || 'Failed to load upload details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load upload details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!uploadJob || uploadJob.validRows === 0) {
      setError('No valid products to submit for approval');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/supplier/catalog/uploads/${jobId}/submit`);
      
      if (response.data.success) {
        // Reload to get updated status
        await loadUploadDetails();
        alert('Catalog submitted for approval successfully!');
      } else {
        setError(response.data.message || 'Failed to submit for approval');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = stagedProducts.filter(product => {
    if (filter === 'valid') return product.status === 'valid';
    if (filter === 'invalid') return product.status === 'invalid';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading upload details...</div>
      </div>
    );
  }

  if (error && !uploadJob) {
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

  if (!uploadJob) {
    return <div>Upload job not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Catalog Upload Review</h1>
          <p className="text-textSecondary mt-1">{uploadJob.fileName}</p>
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
          <div className="text-lg font-semibold text-textPrimary capitalize">{uploadJob.status.replace('_', ' ')}</div>
        </div>
        <div className="p-4 bg-surfaceLight rounded-lg border border-border">
          <div className="text-sm text-textSecondary mb-1">Total Rows</div>
          <div className="text-lg font-semibold text-textPrimary">{uploadJob.totalRows}</div>
        </div>
        <div className="p-4 bg-success/10 rounded-lg border border-success">
          <div className="text-sm text-textSecondary mb-1">Valid Rows</div>
          <div className="text-lg font-semibold text-success">{uploadJob.validRows}</div>
        </div>
        <div className="p-4 bg-error/10 rounded-lg border border-error">
          <div className="text-sm text-textSecondary mb-1">Invalid Rows</div>
          <div className="text-lg font-semibold text-error">{uploadJob.invalidRows}</div>
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
          All ({stagedProducts.length})
        </button>
        <button
          onClick={() => setFilter('valid')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'valid' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Valid ({uploadJob.validRows})
        </button>
        <button
          onClick={() => setFilter('invalid')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'invalid' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Invalid ({uploadJob.invalidRows})
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-surfaceLight rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Row</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Cost</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Errors</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-textSecondary">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product._id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3 text-sm text-textPrimary">{product.rowNumber}</td>
                    <td className="px-4 py-3 text-sm text-textPrimary">{product.normalizedData.productName}</td>
                    <td className="px-4 py-3 text-sm text-textPrimary font-mono">{product.normalizedData.sku}</td>
                    <td className="px-4 py-3 text-sm text-textPrimary">${product.normalizedData.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-textPrimary">{product.normalizedData.stock}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.status === 'valid'
                            ? 'bg-success/10 text-success'
                            : product.status === 'invalid'
                            ? 'bg-error/10 text-error'
                            : 'bg-textSecondary/10 text-textSecondary'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {product.validationErrors.length > 0 ? (
                        <div className="text-xs text-error">
                          {product.validationErrors.map((err, idx) => (
                            <div key={idx}>{err.message}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-textSecondary">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {uploadJob.status === 'pending_approval' && (
        <div className="p-4 bg-primary/10 border border-primary rounded-lg">
          <p className="text-textPrimary mb-2">This catalog has been submitted for approval.</p>
          <p className="text-sm text-textSecondary">An admin will review and approve or reject it.</p>
        </div>
      )}

      {uploadJob.status === 'approved' && (
        <div className="p-4 bg-success/10 border border-success rounded-lg">
          <p className="text-success font-medium">✓ This catalog has been approved and products are now live.</p>
        </div>
      )}

      {uploadJob.status === 'rejected' && (
        <div className="p-4 bg-error/10 border border-error rounded-lg">
          <p className="text-error font-medium">✗ This catalog has been rejected.</p>
        </div>
      )}

      {uploadJob.status === 'pending_approval' && uploadJob.validRows > 0 && (
        <div className="flex justify-end gap-4">
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting || uploadJob.status !== 'pending_approval'}
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

