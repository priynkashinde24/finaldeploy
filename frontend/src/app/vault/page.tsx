'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { documentVaultAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type DocumentCategory = 'kyc' | 'invoice' | 'contract' | 'license' | 'certificate' | 'statement' | 'agreement' | 'other';
type DocumentStatus = 'active' | 'archived' | 'expired' | 'deleted';

interface Document {
  id: string;
  documentId: string;
  name: string;
  description?: string;
  category: DocumentCategory;
  tags: string[];
  status: DocumentStatus;
  ownerId: any;
  ownerRole: string;
  currentVersion: number;
  currentFileSize: number;
  currentMimeType: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  kyc: 'KYC Documents',
  invoice: 'Invoices',
  contract: 'Contracts',
  license: 'Licenses',
  certificate: 'Certificates',
  statement: 'Statements',
  agreement: 'Agreements',
  other: 'Other',
};

export default function DocumentVaultPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    search: '',
    tag: '',
  });
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await documentVaultAPI.listDocuments({
        category: filters.category || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        tag: filters.tag || undefined,
      });

      if (response.success) {
        setDocuments(response.data.documents || []);
      } else {
        setError(response.message || 'Failed to load documents');
      }
    } catch (err: any) {
      console.error('[DOCUMENT VAULT] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId: string) => {
    try {
      const blob = await documentVaultAPI.downloadDocument(documentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = documentId;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('[DOCUMENT VAULT] Download error:', err);
      alert(err.response?.data?.message || 'Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Document Vault</h1>
            <p className="text-text-secondary">Securely store and manage your documents</p>
          </div>
          <Button onClick={() => router.push('/vault/upload')} variant="primary">
            Upload Document
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-red-400">Error</div>
                <div className="text-sm text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-surface border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filter-category" className="text-text-secondary mb-2 block text-sm font-medium">
                  Category
                </label>
                <select
                  id="filter-category"
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filter-status" className="text-text-secondary mb-2 block text-sm font-medium">
                  Status
                </label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-search" className="text-text-secondary mb-2 block text-sm font-medium">
                  Search
                </label>
                <Input
                  id="filter-search"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search documents..."
                />
              </div>
              <div>
                <label htmlFor="filter-tag" className="text-text-secondary mb-2 block text-sm font-medium">
                  Tag
                </label>
                <Input
                  id="filter-tag"
                  value={filters.tag}
                  onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                  placeholder="Filter by tag..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary mb-4">No documents found</p>
                <Button onClick={() => router.push('/vault/upload')} variant="primary">
                  Upload Your First Document
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Name</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Category</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Size</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Version</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Status</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Created</th>
                      <th className="py-3 px-4 text-sm font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium">{doc.name}</p>
                            {doc.description && (
                              <p className="text-sm text-text-secondary mt-1">{doc.description.substring(0, 50)}...</p>
                            )}
                            {doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {doc.tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-text-secondary">{CATEGORY_LABELS[doc.category]}</span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          {formatFileSize(doc.currentFileSize)}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">
                          v{doc.currentVersion}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                              doc.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : doc.status === 'archived'
                                  ? 'bg-gray-500/20 text-gray-400'
                                  : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {formatDate(doc.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => router.push(`/vault/${doc.documentId}`)}
                              variant="secondary"
                              size="sm"
                            >
                              View
                            </Button>
                            <Button
                              onClick={() => handleDownload(doc.documentId)}
                              variant="primary"
                              size="sm"
                            >
                              Download
                            </Button>
                          </div>
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
    </div>
  );
}

