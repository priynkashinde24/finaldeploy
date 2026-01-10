'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { fetchUsers, createUser, updateUserStatus, resetUserPassword, approveUser, blockUser, deleteUser, User, CreateUserData } from '@/lib/adminUsers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState<'admin' | 'supplier' | 'reseller' | ''>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Create user form
  const [createForm, setCreateForm] = useState<CreateUserData>({
    name: '',
    email: '',
    role: 'reseller',
    password: '',
  });
  
  // Reset password form
  const [resetPassword, setResetPassword] = useState('');
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter, pagination.page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchUsers({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (response.success && response.data) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || 'Failed to load users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await createUser(createForm);

      if (response.success) {
        setSuccessMessage('User created successfully');
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', role: 'reseller', password: '' });
        loadUsers();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleApprove = async (user: User) => {
    // Prevent admin from approving themselves
    if (currentUser?.id === user.id) {
      setError('You cannot approve your own account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Disable actions for admin users
    if (user.role === 'admin') {
      setError('Cannot modify admin users');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setActionLoading(user.id);
      setError(null);
      const response = await approveUser(user.id);

      if (response.success) {
        setSuccessMessage(`User ${user.email} approved successfully`);
        loadUsers();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to approve user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (user: User) => {
    // Prevent admin from blocking themselves
    if (currentUser?.id === user.id) {
      setError('You cannot block your own account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Disable actions for admin users
    if (user.role === 'admin') {
      setError('Cannot modify admin users');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setActionLoading(user.id);
      setError(null);
      const response = await blockUser(user.id);

      if (response.success) {
        setSuccessMessage(`User ${user.email} blocked successfully`);
        loadUsers();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to block user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to block user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    // Prevent admin from deleting themselves
    if (currentUser?.id === user.id) {
      setError('You cannot delete your own account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Disable actions for admin users
    if (user.role === 'admin') {
      setError('Cannot modify admin users');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSelectedUser(user);
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(selectedUser.id);
      setError(null);
      const response = await deleteUser(selectedUser.id);

      if (response.success) {
        setSuccessMessage(`User ${selectedUser.email} deleted successfully`);
        setShowConfirmDeleteModal(false);
        setSelectedUser(null);
        loadUsers();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to delete user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setError(null);
      const response = await resetUserPassword(selectedUser.id, resetPassword);

      if (response.success) {
        setSuccessMessage('Password reset successfully');
        setShowResetPasswordModal(false);
        setResetPassword('');
        setSelectedUser(null);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    }
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setResetPassword('');
    setShowResetPasswordModal(true);
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-text-secondary">Manage users, roles, and account status</p>
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

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-4">
                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as any);
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#B00000]"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="supplier">Supplier</option>
                  <option value="reseller">Reseller</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#B00000]"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="md"
                glow
              >
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No users found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#242424]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Email Verified</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors">
                          <td className="py-3 px-4 text-white">{user.name}</td>
                          <td className="py-3 px-4 text-text-secondary">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              user.role === 'admin' && 'bg-[#B00000]/20 text-[#B00000]',
                              user.role === 'supplier' && 'bg-[#D4AF37]/20 text-[#D4AF37]',
                              user.role === 'reseller' && 'bg-[#40E0D0]/20 text-[#40E0D0]',
                            )}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {user.isBlocked ? (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                                  Blocked
                                </span>
                              ) : user.isActive ? (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                                  Pending
                                </span>
                              )}
                              {user.approvedAt && (
                                <span className="text-xs text-text-muted">
                                  Approved {new Date(user.approvedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              'px-2 py-1 rounded text-xs font-semibold',
                              user.isEmailVerified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            )}>
                              {user.isEmailVerified ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2 flex-wrap">
                              {/* Approve button - only show if not active */}
                              {!user.isActive && !user.isBlocked && user.role !== 'admin' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleApprove(user)}
                                  disabled={actionLoading === user.id || currentUser?.id === user.id}
                                >
                                  {actionLoading === user.id ? '...' : 'Approve'}
                                </Button>
                              )}
                              
                              {/* Block button - only show if active and not blocked */}
                              {user.isActive && !user.isBlocked && user.role !== 'admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleBlock(user)}
                                  disabled={actionLoading === user.id || currentUser?.id === user.id}
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                >
                                  {actionLoading === user.id ? '...' : 'Block'}
                                </Button>
                              )}
                              
                              {/* Delete button - show for all non-admin users */}
                              {user.role !== 'admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteClick(user)}
                                  disabled={actionLoading === user.id || currentUser?.id === user.id}
                                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                >
                                  {actionLoading === user.id ? '...' : 'Delete'}
                                </Button>
                              )}
                              
                              {/* Reset Password button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openResetPasswordModal(user)}
                                disabled={actionLoading === user.id}
                              >
                                Reset Password
                              </Button>
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

        {/* Create User Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateForm({ name: '', email: '', role: 'reseller', password: '' });
          }}
          title="Create New User"
          size="md"
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Name</label>
              <Input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                placeholder="john@example.com"
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
            <div>
              <label className="block text-sm font-medium text-white mb-2">Temporary Password</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" size="md" glow className="flex-1">
                Create User
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ name: '', email: '', role: 'reseller', password: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>

        {/* Reset Password Modal */}
        <Modal
          isOpen={showResetPasswordModal}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUser(null);
            setResetPassword('');
          }}
          title={`Reset Password for ${selectedUser?.name || 'User'}`}
          size="md"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">New Password</label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" size="md" glow className="flex-1">
                Reset Password
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedUser(null);
                  setResetPassword('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>

        {/* Confirm Delete Modal */}
        <Modal
          isOpen={showConfirmDeleteModal}
          onClose={() => {
            setShowConfirmDeleteModal(false);
            setSelectedUser(null);
          }}
          title="Confirm Delete User"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-text-secondary">
              Are you sure you want to <strong className="text-red-400">permanently delete</strong> user{' '}
              <strong className="text-white">{selectedUser?.name}</strong> ({selectedUser?.email})?
            </p>
            <p className="text-sm text-red-400">
              This action cannot be undone. All user data will be permanently removed.
            </p>
            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={confirmDelete}
                disabled={actionLoading === selectedUser?.id}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                {actionLoading === selectedUser?.id ? 'Deleting...' : 'Delete User'}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowConfirmDeleteModal(false);
                  setSelectedUser(null);
                }}
                disabled={actionLoading === selectedUser?.id}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
    </div>
  );
}

