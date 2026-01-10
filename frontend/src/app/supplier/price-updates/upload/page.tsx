'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function PriceUpdateUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().split('.').pop();
      if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
        setFile(selectedFile);
        setError(null);
        setSuccess(null);
      } else {
        setError('Invalid file type. Please upload a CSV or XLSX file.');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/supplier/price-updates/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setSuccess('Price update file uploaded successfully! Processing started.');
        setTimeout(() => {
          router.push(`/supplier/price-updates/${response.data.data.updateJobId}`);
        }, 2000);
      } else {
        setError(response.data.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload price update file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ['SKU', 'Price'],
      ['SKU001', '29.99'],
      ['SKU002', '49.99'],
      ['SKU003', '19.99'],
    ];

    const csvContent = sampleData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'price-update-sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Upload Price Update</h1>
          <p className="text-textSecondary mt-1">Bulk update product prices via CSV/XLSX</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-surfaceLight text-textPrimary rounded-lg hover:bg-surfaceLight/80"
        >
          Back
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-primary/10 border border-primary rounded-lg">
        <h3 className="font-semibold text-textPrimary mb-2">File Format Requirements:</h3>
        <ul className="list-disc list-inside text-sm text-textSecondary space-y-1">
          <li>CSV or XLSX format</li>
          <li>Required columns: <code className="bg-surfaceLight px-2 py-1 rounded">SKU</code> and <code className="bg-surfaceLight px-2 py-1 rounded">Price</code></li>
          <li>SKU must match existing products in your catalog</li>
          <li>Price must be a positive number</li>
          <li>Maximum file size: 5MB</li>
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error/10 border border-error rounded-lg">
          <p className="text-error">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-success/10 border border-success rounded-lg">
          <p className="text-success">{success}</p>
          <p className="text-sm text-textSecondary mt-1">Redirecting to details page...</p>
        </div>
      )}

      {/* Upload Card */}
      <div className="bg-surfaceLight rounded-lg border border-border p-6">
        <div className="space-y-6">
          {/* File Input */}
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-textPrimary mb-2">
              Select File <span className="text-error">*</span>
            </label>
            <div className="flex gap-4">
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-surface text-textPrimary rounded-lg hover:bg-surface/80 disabled:opacity-50"
              >
                Choose File
              </button>
              {file && (
                <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg">
                  <span className="text-sm text-textPrimary">{file.name}</span>
                  <span className="text-xs text-textSecondary">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-textSecondary">
              Supported formats: CSV, XLSX (Max 5MB)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Price Update'}
            </button>
            <button
              onClick={handleDownloadSample}
              disabled={uploading}
              className="px-6 py-2 bg-surfaceLight text-textPrimary rounded-lg hover:bg-surfaceLight/80 disabled:opacity-50"
            >
              Download Sample CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

