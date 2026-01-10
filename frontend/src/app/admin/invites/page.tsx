'use client';

import React, { useState, useEffect } from 'react';
import { createInvite, listInvites, Invite } from '@/lib/invites';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'expired' | 'used' | ''>('');

  // Create invite form
  const [createForm, setCreateForm] = useState({
    email: '',
    role: 'reseller' as 'supplier' | 'reseller',
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadInvites();
  }, [statusFilter, pagination.page]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listInvites({
        status: statusFilter || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (response.success && response.data) {
        setInvites(response.data.invites);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || 'Failed to load invites');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await createInvite(createForm);

      if (response.success) {
        setSuccessMessage('Invite sent successfully');
        setCreateForm({ email: '', role: 'reseller' });
        loadInvites();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to create invite');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create invite');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Invitations</h1>
          <p className="text-text-secondary">Send invitation links to new users</p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Create Invite Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Send Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-white mb-2">Email</label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'supplier' | 'reseller' })}
                    className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#B00000]"
                    required
                  >
                    <option value="reseller">Reseller</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>
              </div>
              <Button type="submit" variant="primary" size="md" glow>
                Send Invitation
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Invites List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sent Invitations ({pagination.total})</CardTitle>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#B00000]"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="used">Used</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading invites...</p>
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No invites found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#242424]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Expires At</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((invite) => (
                        <tr key={invite.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                          <td className="py-3 px-4 text-white">{invite.email}</td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded text-xs font-semibold',
                                invite.role === 'supplier' && 'bg-[#D4AF37]/20 text-[#D4AF37]',
                                invite.role === 'reseller' && 'bg-[#40E0D0]/20 text-[#40E0D0]'
                              )}
                            >
                              {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={cn(
                                'px-2 py-1 rounded text-xs font-semibold',
                                invite.status === 'pending' && 'bg-green-500/20 text-green-400',
                                invite.status === 'expired' && 'bg-red-500/20 text-red-400',
                                invite.status === 'used' && 'bg-gray-500/20 text-gray-400'
                              )}
                            >
                              {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-sm">
                            {formatDate(invite.expiresAt)}
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-sm">
                            {formatDate(invite.createdAt)}
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
      </div>
    </div>
  );
}

