'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { userAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  approvalStatus: string;
}

export default function ResellerSettingsPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'reseller') {
      router.push('/unauthorized');
      return;
    }
    loadProfile();
  }, [user, router]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userAPI.getProfile();
      if (response.success && response.data?.user) {
        const userData = response.data.user;
        setProfile(userData);
        setName(userData.name || '');
        setPhone(userData.phone || '');
      } else {
        setError(response.message || 'Failed to load profile');
      }
    } catch (err: any) {
      console.error('[SETTINGS] Load error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await userAPI.updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      if (response.success) {
        setSuccess('Profile updated successfully');
        if (response.data?.user) {
          setProfile(response.data.user);
        }
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('[SETTINGS] Update error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        setSaving(false);
        return;
      }

      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        setSaving(false);
        return;
      }

      const response = await userAPI.changePassword({
        currentPassword,
        newPassword,
      });

      if (response.success) {
        setSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(response.message || 'Failed to change password');
      }
    } catch (err: any) {
      console.error('[SETTINGS] Password change error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-text-secondary">Configure your reseller account settings</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Profile Settings */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
              <Input
                type="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted/50 text-text-secondary"
              />
              <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Phone Number</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
              <p className="text-xs text-text-muted mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Status */}
      {profile && (
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Email Verification</span>
                <span
                  className={cn(
                    'px-2 py-1 rounded-full text-xs font-semibold',
                    profile.isEmailVerified
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  )}
                >
                  {profile.isEmailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Account Status</span>
                <span
                  className={cn(
                    'px-2 py-1 rounded-full text-xs font-semibold',
                    profile.isActive
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  )}
                >
                  {profile.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Approval Status</span>
                <span
                  className={cn(
                    'px-2 py-1 rounded-full text-xs font-semibold',
                    profile.approvalStatus === 'approved'
                      ? 'bg-green-500/20 text-green-400'
                      : profile.approvalStatus === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                  )}
                >
                  {profile.approvalStatus.charAt(0).toUpperCase() + profile.approvalStatus.slice(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
