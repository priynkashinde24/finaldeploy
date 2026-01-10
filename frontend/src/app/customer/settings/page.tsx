'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { userAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Validation functions
const validateProfile = (name: string, phone: string) => {
  if (name && name.length < 2) {
    return 'Name must be at least 2 characters';
  }
  if (name && name.length > 100) {
    return 'Name must not exceed 100 characters';
  }
  return null;
};

const validatePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => {
  if (!currentPassword) {
    return 'Current password is required';
  }
  if (!newPassword) {
    return 'New password is required';
  }
  if (newPassword.length < 6) {
    return 'New password must be at least 6 characters';
  }
  if (newPassword !== confirmPassword) {
    return "New passwords don't match";
  }
  return null;
};

export default function CustomerSettingsPage() {
  const router = useRouter();
  const currentUser = getCurrentUser();

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    isEmailVerified: false,
    isActive: false,
    approvalStatus: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, [currentUser, router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setProfileError(null);
      const response = await userAPI.getProfile();
      if (response.success && response.data) {
        // Backend returns: { success: true, data: { user: { id, name, email, phone, ... } } }
        const userData = response.data.user || response.data;
        setProfile({
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || '',
          isEmailVerified: userData.isEmailVerified || false,
          isActive: userData.isActive || false,
          approvalStatus: userData.approvalStatus || '',
        });
      } else {
        setProfileError(response.message || 'Failed to fetch profile');
      }
    } catch (err: any) {
      console.error('[CUSTOMER SETTINGS] Fetch profile error:', err);
      setProfileError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const validationError = validateProfile(profile.name, profile.phone);
      if (validationError) {
        setProfileError(validationError);
        setProfileLoading(false);
        return;
      }

      const response = await userAPI.updateProfile({
        name: profile.name.trim(),
        phone: profile.phone.trim() || undefined,
      });
      if (response.success) {
        setProfileSuccess('Profile updated successfully!');
        // Optionally refetch profile to ensure data consistency
        fetchProfile();
      } else {
        setProfileError(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
      setTimeout(() => setProfileSuccess(null), 5000);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const validationError = validatePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );
      if (validationError) {
        setPasswordError(validationError);
        setPasswordLoading(false);
        return;
      }

      const response = await userAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (response.success) {
        setPasswordSuccess('Password changed successfully! You will be logged out.');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        // Force logout after successful password change
        setTimeout(() => {
          localStorage.removeItem('token');
          router.push('/login');
        }, 3000);
      } else {
        setPasswordError(response.message || 'Failed to change password');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
      setTimeout(() => setPasswordSuccess(null), 5000);
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
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-text-secondary">
            Manage your customer account settings
          </p>
        </div>

        {/* Profile Information Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
                  {profileSuccess}
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                <Input id="email" name="email" type="email" value={profile.email} disabled className="opacity-70" />
                <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">Name</label>
                <Input id="name" name="name" type="text" value={profile.name} onChange={handleProfileChange} />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-text-secondary mb-2">Phone Number</label>
                <Input id="phone" name="phone" type="tel" value={profile.phone} onChange={handleProfileChange} />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
                  {passwordSuccess}
                </div>
              )}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-text-secondary mb-2">Current Password</label>
                <Input id="currentPassword" name="currentPassword" type="password" value={passwordForm.currentPassword} onChange={handlePasswordChange} />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-2">New Password</label>
                <Input id="newPassword" name="newPassword" type="password" value={passwordForm.newPassword} onChange={handlePasswordChange} />
                <p className="text-xs text-text-muted mt-1">Must be at least 6 characters</p>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">Confirm New Password</label>
                <Input id="confirmPassword" name="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={handlePasswordChange} />
              </div>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account Status Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-text-secondary">
            <p><strong>Role:</strong> {profile.role}</p>
            <p><strong>Email Verified:</strong> {profile.isEmailVerified ? 'Yes' : 'No'}</p>
            <p><strong>Account Active:</strong> {profile.isActive ? 'Yes' : 'No'}</p>
            <p><strong>Approval Status:</strong> {profile.approvalStatus}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
