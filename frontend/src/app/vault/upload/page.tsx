'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { documentVaultAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

type DocumentCategory = 'kyc' | 'invoice' | 'contract' | 'license' | 'certificate' | 'statement' | 'agreement' | 'other';

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

export default function UploadDocumentPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [formData, setFormData] = useState({
    category: 'other' as DocumentCategory,
    name: '',
    description: '',
    tags: '',
    expiresAt: '',
    autoRenew: false,
    renewalReminderDays: 30,
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!formData.name) {
        setFormData({ ...formData, name: e.target.files[0].name });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!formData.name) {
      setError('Please enter a document name');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const uploadFormData = new FormData();
      uploadFormData.append('document', file);
      
      const dataPayload = {
        category: formData.category,
        name: formData.name,
        description: formData.description || undefined,
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()) : undefined,
        expiresAt: formData.expiresAt || undefined,
        autoRenew: formData.autoRenew,
        renewalReminderDays: formData.renewalReminderDays,
      };
      
      uploadFormData.append('data', JSON.stringify(dataPayload));

      const response = await documentVaultAPI.uploadDocument(uploadFormData);

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/vault');
        }, 2000);
      } else {
        setError(response.message || 'Failed to upload document');
      }
    } catch (err: any) {
      console.error('[DOCUMENT VAULT] Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Document</h1>
          <p className="text-text-secondary">Securely upload and encrypt your documents</p>
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

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-green-400">Success!</div>
                <div className="text-sm text-green-300">Document uploaded successfully. Redirecting...</div>
              </div>
            </div>
          </div>
        )}

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Document Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="file" className="text-text-secondary mb-2 block text-sm font-medium">
                  Document File *
                </label>
                <input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {file && (
                  <p className="text-sm text-text-secondary mt-1">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="text-text-secondary mb-2 block text-sm font-medium">
                  Document Name *
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter document name"
                  required
                />
              </div>

              <div>
                <label htmlFor="category" className="text-text-secondary mb-2 block text-sm font-medium">
                  Category *
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as DocumentCategory })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="text-text-secondary mb-2 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter document description"
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="tags" className="text-text-secondary mb-2 block text-sm font-medium">
                  Tags (comma-separated)
                </label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., invoice, payment, 2024"
                />
              </div>

              <div>
                <label htmlFor="expiresAt" className="text-text-secondary mb-2 block text-sm font-medium">
                  Expiration Date (Optional)
                </label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="autoRenew"
                  type="checkbox"
                  checked={formData.autoRenew}
                  onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <label htmlFor="autoRenew" className="text-text-secondary text-sm">
                  Auto-renew before expiration
                </label>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={uploading || success}
                  variant="primary"
                  className="flex-1"
                >
                  {uploading ? 'Uploading...' : success ? 'Uploaded!' : 'Upload Document'}
                </Button>
                <Button
                  type="button"
                  onClick={() => router.back()}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

