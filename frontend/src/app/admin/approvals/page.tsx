'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getApprovals, approveApproval, rejectApproval, PendingApproval, ApprovalStatus, ApprovalType } from '@/lib/adminApprovals';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<ApprovalStatus>('pending');
  
  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      return;
    }
    loadApprovals();
  }, [activeTab, currentUser]);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all approvals (no status filter) so we can show them in tabs
      const response = await getApprovals();
      
      if (response.success && response.data) {
        setApprovals(response.data.approvals);
      } else {
        setError(response.message || 'Failed to load approvals');
      }
    } catch (err: any) {
      console.error('[ADMIN APPROVALS] Load error:', err);
      setError(err.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: PendingApproval) => {
    // Safety check: prevent admin from approving themselves
    if (approval.type === 'supplier' || approval.type === 'reseller') {
      if (approval.entityId === currentUser?.id) {
        setError('You cannot approve your own account');
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    try {
      setActionLoading(`${approval.type}-${approval.entityId}`);
      setError(null);
      
      const response = await approveApproval(approval.type, approval.entityId);
      
      if (response.success) {
        const typeLabel = approval.type === 'kyc' ? 'KYC' : approval.type;
        setSuccessMessage(`${typeLabel} approved successfully`);
        loadApprovals(); // Refresh list
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to approve');
      }
    } catch (err: any) {
      console.error('[ADMIN APPROVALS] Approve error:', err);
      setError(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (approval: PendingApproval) => {
    // Safety check: prevent admin from rejecting themselves
    if (approval.type === 'supplier' || approval.type === 'reseller') {
      if (approval.entityId === currentUser?.id) {
        setError('You cannot reject your own account');
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    setSelectedApproval(approval);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedApproval || !rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    try {
      setActionLoading(`${selectedApproval.type}-${selectedApproval.entityId}`);
      setError(null);
      
      const response = await rejectApproval(
        selectedApproval.type,
        selectedApproval.entityId,
        rejectionReason.trim()
      );
      
      if (response.success) {
        const typeLabel = selectedApproval.type === 'kyc' ? 'KYC' : selectedApproval.type;
        setSuccessMessage(`${typeLabel} rejected successfully`);
        setShowRejectModal(false);
        setSelectedApproval(null);
        setRejectionReason('');
        loadApprovals(); // Refresh list
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to reject');
      }
    } catch (err: any) {
      console.error('[ADMIN APPROVALS] Reject error:', err);
      setError(err.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const getTypeLabel = (type: ApprovalType): string => {
    switch (type) {
      case 'supplier':
        return 'Supplier';
      case 'kyc':
        return 'KYC';
      case 'reseller':
        return 'Reseller';
      default:
        return type;
    }
  };

  const getTypeColor = (type: ApprovalType): string => {
    switch (type) {
      case 'supplier':
        return 'bg-[#D4AF37]/20 text-[#D4AF37]';
      case 'kyc':
        return 'bg-blue-500/20 text-blue-400';
      case 'reseller':
        return 'bg-[#40E0D0]/20 text-[#40E0D0]';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (status: ApprovalStatus): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'approved':
        return 'bg-green-500/20 text-green-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Filter approvals by active tab
  const filteredApprovals = approvals.filter(a => a.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Approval Workflow</h1>
        <p className="text-text-secondary">Review and approve pending requests</p>
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

      {/* Tabs */}
      <Card className="bg-surface border-border">
        <CardContent className="p-0">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                'px-6 py-4 text-sm font-medium transition-colors',
                activeTab === 'pending'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Pending ({approvals.filter(a => a.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={cn(
                'px-6 py-4 text-sm font-medium transition-colors',
                activeTab === 'approved'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Approved ({approvals.filter(a => a.status === 'approved').length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={cn(
                'px-6 py-4 text-sm font-medium transition-colors',
                activeTab === 'rejected'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Rejected ({approvals.filter(a => a.status === 'rejected').length})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Approvals`} ({filteredApprovals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-text-secondary">Loading approvals...</p>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">No {activeTab} approvals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#242424]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name / Email</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Submitted</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                    {activeTab === 'rejected' && (
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Rejection Reason</th>
                    )}
                    <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map((approval) => {
                    const actionKey = `${approval.type}-${approval.entityId}`;
                    const isLoading = actionLoading === actionKey;
                    const isSelfAction = (approval.type === 'supplier' || approval.type === 'reseller') && 
                                         approval.entityId === currentUser?.id;
                    
                    return (
                      <tr key={actionKey} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded text-xs font-semibold', getTypeColor(approval.type))}>
                            {getTypeLabel(approval.type)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            {approval.name && (
                              <p className="text-white">{approval.name}</p>
                            )}
                            <p className="text-sm text-text-secondary">{approval.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {new Date(approval.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded text-xs font-semibold', getStatusColor(approval.status))}>
                            {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                          </span>
                        </td>
                        {activeTab === 'rejected' && (
                          <td className="py-3 px-4">
                            {approval.rejectionReason ? (
                              <div className="max-w-md">
                                <p className="text-sm text-text-secondary line-clamp-2" title={approval.rejectionReason}>
                                  {approval.rejectionReason}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-text-muted">No reason provided</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            {approval.status === 'pending' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleApprove(approval)}
                                  disabled={isLoading || isSelfAction}
                                >
                                  {isLoading ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectClick(approval)}
                                  disabled={isLoading || isSelfAction}
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                >
                                  {isLoading ? '...' : 'Reject'}
                                </Button>
                              </>
                            )}
                            {approval.status !== 'pending' && (
                              <span className="text-xs text-text-muted">No actions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedApproval(null);
          setRejectionReason('');
        }}
        title={`Reject ${selectedApproval ? getTypeLabel(selectedApproval.type) : 'Approval'}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Please provide a reason for rejecting this {selectedApproval?.type || 'request'}. This will be shown to the user.
          </p>
          {selectedApproval && (
            <div className="p-3 bg-surfaceLight rounded-lg">
              <p className="text-sm text-text-muted mb-1">Rejecting:</p>
              <p className="text-white font-medium">{selectedApproval.name || selectedApproval.email}</p>
              <p className="text-sm text-text-secondary">{selectedApproval.email}</p>
            </div>
          )}
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
              disabled={actionLoading === `${selectedApproval?.type}-${selectedApproval?.entityId}` || rejectionReason.trim().length < 10}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {actionLoading === `${selectedApproval?.type}-${selectedApproval?.entityId}` ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedApproval(null);
                setRejectionReason('');
              }}
              disabled={actionLoading === `${selectedApproval?.type}-${selectedApproval?.entityId}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

