'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface UploadJob {
  _id: string;
  fileName: string;
  fileType: 'csv' | 'xlsx';
  status: 'uploaded' | 'processing' | 'validation_failed' | 'pending_approval' | 'approved' | 'rejected';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdAt: string;
  completedAt?: string;
}

export default function CatalogUploadsPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadUploads();
  }, [statusFilter]);

  const loadUploads = async () => {
    try {
      setLoading(true);
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await api.get('/supplier/catalog/uploads', { params });
      
      if (response.data.success) {
        setUploads(response.data.data.uploads || []);
      } else {
        setError(response.data.message || 'Failed to load uploads');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success/10 text-success border-success';
      case 'rejected':
        return 'bg-error/10 text-error border-error';
      case 'pending_approval':
        return 'bg-primary/10 text-primary border-primary';
      case 'processing':
        return 'bg-textSecondary/10 text-textSecondary border-textSecondary';
      case 'validation_failed':
        return 'bg-error/10 text-error border-error';
      default:
        return 'bg-surfaceLight text-textPrimary border-border';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading uploads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Catalog Uploads</h1>
          <p className="text-textSecondary mt-1">View and manage your catalog uploads</p>
        </div>
        <Link
          href="/supplier/catalog/upload"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Upload New Catalog
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-textSecondary">Filter by status:</span>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg ${
            !statusFilter ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('pending_approval')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'pending_approval' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Pending Approval
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'approved' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-4 py-2 rounded-lg ${
            statusFilter === 'rejected' ? 'bg-primary text-white' : 'bg-surfaceLight text-textPrimary'
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error/10 border border-error rounded-lg">
          <p className="text-error">{error}</p>
        </div>
      )}

      {/* Uploads Table */}
      {uploads.length === 0 ? (
        <div className="p-12 text-center bg-surfaceLight rounded-lg border border-border">
          <p className="text-textSecondary mb-4">No uploads found</p>
          <Link
            href="/supplier/catalog/upload"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 inline-block"
          >
            Upload Your First Catalog
          </Link>
        </div>
      ) : (
        <div className="bg-surfaceLight rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">File Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Total Rows</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Valid</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Invalid</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr key={upload._id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3 text-sm text-textPrimary">{upload.fileName}</td>
                    <td className="px-4 py-3 text-sm text-textPrimary uppercase">{upload.fileType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(upload.status)}`}
                      >
                        {upload.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-textPrimary">{upload.totalRows}</td>
                    <td className="px-4 py-3 text-sm text-success">{upload.validRows}</td>
                    <td className="px-4 py-3 text-sm text-error">{upload.invalidRows}</td>
                    <td className="px-4 py-3 text-sm text-textSecondary">
                      {new Date(upload.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/supplier/catalog/uploads/${upload._id}`}
                        className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

