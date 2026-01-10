'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface KYCRequest {
  id: string;
  supplier: {
    id: string;
    name: string;
    email: string;
  };
  businessName: string;
  panNumber: string;
  aadhaarNumber: string;
  gstNumber?: string;
  documents: {
    panCardUrl: string;
    aadhaarFrontUrl: string;
    aadhaarBackUrl: string;
    gstCertificateUrl?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export default function AdminKYCPage() {
  const [kycRequests, setKycRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('');
  
  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedKYC, setSelectedKYC] = useState<KYCRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      return;
    }
    loadKYCRequests();
  }, [statusFilter, pagination.page, currentUser]);

  const loadKYCRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await api.get(`/admin/kyc?${params.toString()}`);
      
      if (response.data.success && response.data.data) {
        setKycRequests(response.data.data.kycRequests);
        setPagination(response.data.data.pagination);
      } else {
        setError(response.data.message || 'Failed to load KYC requests');
      }
    } catch (err: any) {
      console.error('[ADMIN KYC] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load KYC requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (kyc: KYCRequest) => {
    try {
      setActionLoading(kyc.id);
      setError(null);
      
      const response = await api.patch(`/admin/kyc/${kyc.id}/approve`);
      
      if (response.data.success) {
        setSuccessMessage(`KYC for ${kyc.supplier.email} approved successfully`);
        loadKYCRequests();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.data.message || 'Failed to approve KYC');
      }
    } catch (err: any) {
      console.error('[ADMIN KYC] Approve error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (kyc: KYCRequest) => {
    setSelectedKYC(kyc);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedKYC || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    try {
      setActionLoading(selectedKYC.id);
      setError(null);
      
      const response = await api.patch(`/admin/kyc/${selectedKYC.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      
      if (response.data.success) {
        setSuccessMessage(`KYC for ${selectedKYC.supplier.email} rejected`);
        setShowRejectModal(false);
        setSelectedKYC(null);
        setRejectionReason('');
        loadKYCRequests();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.data.message || 'Failed to reject KYC');
      }
    } catch (err: any) {
      console.error('[ADMIN KYC] Reject error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDocuments = async (kyc: KYCRequest) => {
    setSelectedKYC(kyc);
    setShowViewModal(true);
  };

  const getDocumentUrl = (url: string) => {
    // File URLs are now served through authenticated API route
    // Format: /api/kyc/files/{filename}
    if (url.startsWith('http')) {
      return url;
    }
    // If URL already contains /api/kyc/files, use as is
    if (url.includes('/api/kyc/files/')) {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      return url.startsWith('/') ? `${apiBaseUrl}${url}` : url;
    }
    // Extract filename from path and construct secure URL
    const filename = url.split('/').pop() || '';
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return `${apiBaseUrl}/api/kyc/files/${filename}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">KYC Review</h1>
        <p className="text-text-secondary">Review and approve supplier KYC submissions</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPagination({ ...pagination, page: 1 });
              }}
              className="px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* KYC Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Requests ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading KYC requests...</p>
            </div>
          ) : kycRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">No KYC requests found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#242424]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Supplier</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Business Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">PAN</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Submitted</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kycRequests.map((kyc) => (
                      <tr key={kyc.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white">{kyc.supplier.name}</p>
                            <p className="text-sm text-text-muted">{kyc.supplier.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white">{kyc.businessName}</td>
                        <td className="py-3 px-4 text-text-secondary">{kyc.panNumber}</td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-semibold',
                            kyc.status === 'pending' && 'bg-yellow-500/20 text-yellow-400',
                            kyc.status === 'approved' && 'bg-green-500/20 text-green-400',
                            kyc.status === 'rejected' && 'bg-red-500/20 text-red-400',
                          )}>
                            {kyc.status.charAt(0).toUpperCase() + kyc.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {new Date(kyc.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocuments(kyc)}
                            >
                              View Documents
                            </Button>
                            {kyc.status === 'pending' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleApprove(kyc)}
                                  disabled={actionLoading === kyc.id}
                                >
                                  {actionLoading === kyc.id ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectClick(kyc)}
                                  disabled={actionLoading === kyc.id}
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                >
                                  {actionLoading === kyc.id ? '...' : 'Reject'}
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

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#242424]">
                  <p className="text-sm text-text-secondary">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Documents Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedKYC(null);
        }}
        title={`KYC Documents - ${selectedKYC?.supplier.email}`}
        size="lg"
      >
        {selectedKYC && (
          <div className="space-y-6">
            {/* KYC Information */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-text-muted">Business Name</p>
                <p className="text-white">{selectedKYC.businessName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-muted">PAN Number</p>
                  <p className="text-white">{selectedKYC.panNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Aadhaar Number</p>
                  <p className="text-white">{selectedKYC.aadhaarNumber}</p>
                </div>
              </div>
              {selectedKYC.gstNumber && (
                <div>
                  <p className="text-sm text-text-muted">GST Number</p>
                  <p className="text-white">{selectedKYC.gstNumber}</p>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-white font-semibold">Documents</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-muted mb-2">PAN Card</p>
                  <a
                    href={getDocumentUrl(selectedKYC.documents.panCardUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View Document →
                  </a>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Aadhaar Front</p>
                  <a
                    href={getDocumentUrl(selectedKYC.documents.aadhaarFrontUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View Document →
                  </a>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Aadhaar Back</p>
                  <a
                    href={getDocumentUrl(selectedKYC.documents.aadhaarBackUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View Document →
                  </a>
                </div>
                {selectedKYC.documents.gstCertificateUrl && (
                  <div>
                    <p className="text-sm text-text-muted mb-2">GST Certificate</p>
                    <a
                      href={getDocumentUrl(selectedKYC.documents.gstCertificateUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View Document →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason (if rejected) */}
            {selectedKYC.status === 'rejected' && selectedKYC.rejectionReason && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-text-muted mb-2">Rejection Reason</p>
                <p className="text-red-400">{selectedKYC.rejectionReason}</p>
              </div>
            )}

            {/* Actions (if pending) */}
            {selectedKYC.status === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setShowViewModal(false);
                    handleApprove(selectedKYC);
                  }}
                  disabled={actionLoading === selectedKYC.id}
                  className="flex-1"
                >
                  {actionLoading === selectedKYC.id ? 'Approving...' : 'Approve'}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setShowViewModal(false);
                    handleRejectClick(selectedKYC);
                  }}
                  disabled={actionLoading === selectedKYC.id}
                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject KYC Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedKYC(null);
          setRejectionReason('');
        }}
        title={`Reject KYC - ${selectedKYC?.supplier.email}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Please provide a reason for rejecting this KYC submission. This will be shown to the supplier.
          </p>
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Rejection Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder="Enter rejection reason (minimum 10 characters)..."
              className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-text-muted mt-1">
              {rejectionReason.length}/500 characters (minimum 10)
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleReject}
              disabled={actionLoading === selectedKYC?.id || rejectionReason.trim().length < 10}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {actionLoading === selectedKYC?.id ? 'Rejecting...' : 'Reject KYC'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedKYC(null);
                setRejectionReason('');
              }}
              disabled={actionLoading === selectedKYC?.id}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

