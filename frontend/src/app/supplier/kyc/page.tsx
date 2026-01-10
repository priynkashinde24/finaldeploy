'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';

interface KYCData {
  id?: string;
  businessName: string;
  panNumber: string;
  aadhaarNumber: string;
  gstNumber?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
}

export default function SupplierKYCPage() {
  const [kycData, setKycData] = useState<KYCData>({
    businessName: '',
    panNumber: '',
    aadhaarNumber: '',
    gstNumber: '',
  });
  const [files, setFiles] = useState({
    panCard: null as File | null,
    aadhaarFront: null as File | null,
    aadhaarBack: null as File | null,
    gstCertificate: null as File | null,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingKYC, setExistingKYC] = useState<any>(null);

  const user = getCurrentUser();

  useEffect(() => {
    if (user?.role !== 'supplier') {
      return;
    }
    loadKYCStatus();
  }, [user]);

  const loadKYCStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/kyc');
      if (response.data.success && response.data.data?.kyc) {
        setExistingKYC(response.data.data.kyc);
        setKycData({
          businessName: response.data.data.kyc.businessName || '',
          panNumber: response.data.data.kyc.panNumber || '',
          aadhaarNumber: response.data.data.kyc.aadhaarNumber || '',
          gstNumber: response.data.data.kyc.gstNumber || '',
          status: response.data.data.kyc.status,
          rejectionReason: response.data.data.kyc.rejectionReason,
          submittedAt: response.data.data.kyc.submittedAt,
          reviewedAt: response.data.data.kyc.reviewedAt,
        });
      }
    } catch (err: any) {
      console.error('[KYC] Failed to load KYC status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || user.role !== 'supplier') {
      setError('Only suppliers can submit KYC');
      return;
    }

    // Validate required fields
    if (!kycData.businessName || !kycData.panNumber || !kycData.aadhaarNumber) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate PAN format
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(kycData.panNumber.toUpperCase())) {
      setError('Invalid PAN number format');
      return;
    }

    // Validate Aadhaar format (12 digits)
    if (!/^\d{12}$/.test(kycData.aadhaarNumber.replace(/\s|-/g, ''))) {
      setError('Aadhaar number must be 12 digits');
      return;
    }

    // Validate GST if provided
    if (kycData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(kycData.gstNumber.toUpperCase())) {
      setError('Invalid GST number format');
      return;
    }

    // Validate required files
    if (!files.panCard || !files.aadhaarFront || !files.aadhaarBack) {
      setError('Please upload all required documents');
      return;
    }

    // Check if already approved
    if (existingKYC && existingKYC.status === 'approved') {
      setError('KYC is already approved. Cannot resubmit.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create FormData
      const formData = new FormData();
      formData.append('businessName', kycData.businessName.trim());
      formData.append('panNumber', kycData.panNumber.toUpperCase().trim());
      formData.append('aadhaarNumber', kycData.aadhaarNumber.replace(/\s|-/g, ''));
      if (kycData.gstNumber) {
        formData.append('gstNumber', kycData.gstNumber.toUpperCase().trim());
      }
      formData.append('panCard', files.panCard);
      formData.append('aadhaarFront', files.aadhaarFront);
      formData.append('aadhaarBack', files.aadhaarBack);
      if (files.gstCertificate) {
        formData.append('gstCertificate', files.gstCertificate);
      }

      const response = await api.post('/supplier/kyc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setSuccessMessage('KYC submitted successfully! Awaiting admin review.');
        setFiles({
          panCard: null,
          aadhaarFront: null,
          aadhaarBack: null,
          gstCertificate: null,
        });
        loadKYCStatus();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(response.data.message || 'Failed to submit KYC');
      }
    } catch (err: any) {
      console.error('[KYC] Submit error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to submit KYC');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading KYC status...</p>
        </div>
      </div>
    );
  }

  // Show status if KYC exists
  if (existingKYC) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">KYC Verification</h1>
          <p className="text-text-secondary">Your KYC submission status</p>
        </div>

        {/* Status Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">KYC Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingKYC.status === 'pending' && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-semibold text-yellow-400">Pending Review</h3>
                </div>
                <p className="text-text-secondary">
                  Your KYC documents have been submitted and are awaiting admin review.
                  {existingKYC.submittedAt && (
                    <span className="block mt-2 text-sm">
                      Submitted on: {new Date(existingKYC.submittedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            )}

            {existingKYC.status === 'approved' && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-green-400">Approved</h3>
                </div>
                <p className="text-text-secondary">
                  Your KYC has been approved. You can now access all supplier features.
                  {existingKYC.reviewedAt && (
                    <span className="block mt-2 text-sm">
                      Approved on: {new Date(existingKYC.reviewedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            )}

            {existingKYC.status === 'rejected' && (
              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-semibold text-red-400">Rejected</h3>
                  </div>
                  {existingKYC.rejectionReason && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-white mb-1">Rejection Reason:</p>
                      <p className="text-text-secondary">{existingKYC.rejectionReason}</p>
                    </div>
                  )}
                  {existingKYC.reviewedAt && (
                    <p className="text-sm text-text-muted mt-2">
                      Reviewed on: {new Date(existingKYC.reviewedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Re-upload option */}
                <div className="p-4 bg-surfaceLight border border-border rounded-lg">
                  <h4 className="text-white font-semibold mb-2">Resubmit KYC</h4>
                  <p className="text-text-secondary text-sm mb-4">
                    Please review the rejection reason and resubmit your KYC documents with corrections.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setExistingKYC(null)}
                  >
                    Resubmit KYC
                  </Button>
                </div>
              </div>
            )}

            {/* KYC Details */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-white font-semibold mb-4">Submitted Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-text-muted">Business Name</p>
                  <p className="text-white">{existingKYC.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">PAN Number</p>
                  <p className="text-white">{existingKYC.panNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted">Aadhaar Number</p>
                  <p className="text-white">{existingKYC.aadhaarNumber}</p>
                </div>
                {existingKYC.gstNumber && (
                  <div>
                    <p className="text-sm text-text-muted">GST Number</p>
                    <p className="text-white">{existingKYC.gstNumber}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show submission form
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">KYC Verification</h1>
        <p className="text-text-secondary">Submit your KYC documents for verification</p>
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

      {/* KYC Form */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="text-white">KYC Submission Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Business Name <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={kycData.businessName}
                onChange={(e) => setKycData({ ...kycData, businessName: e.target.value })}
                required
                placeholder="Enter your business name"
                disabled={submitting}
              />
            </div>

            {/* PAN Number */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                PAN Number <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={kycData.panNumber}
                onChange={(e) => setKycData({ ...kycData, panNumber: e.target.value.toUpperCase() })}
                required
                placeholder="ABCDE1234F"
                maxLength={10}
                disabled={submitting}
              />
              <p className="text-xs text-text-muted mt-1">Format: ABCDE1234F</p>
            </div>

            {/* Aadhaar Number */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Aadhaar Number <span className="text-red-400">*</span>
              </label>
              <Input
                type="text"
                value={kycData.aadhaarNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Only digits
                  if (value.length <= 12) {
                    setKycData({ ...kycData, aadhaarNumber: value });
                  }
                }}
                required
                placeholder="1234 5678 9012"
                maxLength={12}
                disabled={submitting}
              />
              <p className="text-xs text-text-muted mt-1">12 digits only</p>
            </div>

            {/* GST Number (Optional) */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                GST Number (Optional)
              </label>
              <Input
                type="text"
                value={kycData.gstNumber || ''}
                onChange={(e) => setKycData({ ...kycData, gstNumber: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                disabled={submitting}
              />
              <p className="text-xs text-text-muted mt-1">Format: 22AAAAA0000A1Z5</p>
            </div>

            {/* File Uploads */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-white font-semibold">Documents</h4>

              {/* PAN Card */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  PAN Card <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => handleFileChange('panCard', e.target.files?.[0] || null)}
                  required={!existingKYC}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">JPEG, PNG, or PDF (Max 5MB)</p>
                {files.panCard && (
                  <p className="text-sm text-green-400 mt-1">✓ {files.panCard.name}</p>
                )}
              </div>

              {/* Aadhaar Front */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Aadhaar Front <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => handleFileChange('aadhaarFront', e.target.files?.[0] || null)}
                  required={!existingKYC}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">JPEG, PNG, or PDF (Max 5MB)</p>
                {files.aadhaarFront && (
                  <p className="text-sm text-green-400 mt-1">✓ {files.aadhaarFront.name}</p>
                )}
              </div>

              {/* Aadhaar Back */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Aadhaar Back <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => handleFileChange('aadhaarBack', e.target.files?.[0] || null)}
                  required={!existingKYC}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">JPEG, PNG, or PDF (Max 5MB)</p>
                {files.aadhaarBack && (
                  <p className="text-sm text-green-400 mt-1">✓ {files.aadhaarBack.name}</p>
                )}
              </div>

              {/* GST Certificate (Optional) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  GST Certificate (Optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => handleFileChange('gstCertificate', e.target.files?.[0] || null)}
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#242424] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-text-muted mt-1">JPEG, PNG, or PDF (Max 5MB)</p>
                {files.gstCertificate && (
                  <p className="text-sm text-green-400 mt-1">✓ {files.gstCertificate.name}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                glow
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Submitting...' : 'Submit KYC'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

