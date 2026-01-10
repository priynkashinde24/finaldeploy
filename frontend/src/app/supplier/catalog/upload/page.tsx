'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { catalogAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UploadReport {
  insertedCount: number;
  failedCount: number;
  totalRows: number;
  failedRecords: Array<{
    row: number;
    data: Record<string, any>;
    errors: string[];
  }>;
}

export default function CatalogUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().split('.').pop();
      if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
        setFile(selectedFile);
        setError(null);
        setReport(null);
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
    setUploadProgress(0);
    setError(null);
    setReport(null);

    try {
      // Simulate progress (in real app, use axios onUploadProgress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await catalogAPI.upload(file, 'default-supplier');

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success && response.data) {
        setReport(response.data);
      } else {
        setError(response.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload catalog');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ['sku', 'name', 'price', 'cost', 'quantity', 'category'],
      ['SKU001', 'Sample Product 1', '29.99', '15.00', '100', 'Electronics'],
      ['SKU002', 'Sample Product 2', '49.99', '25.00', '50', 'Clothing'],
      ['SKU003', 'Sample Product 3', '19.99', '10.00', '200', 'Accessories'],
    ];

    const csvContent = sampleData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'catalog-sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary-off-white dark:bg-dark-background">
      <Navbar />
      <main className="flex-1 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <SectionTitle size="xl" variant="default" className="mb-4">
              Upload Product Catalog
            </SectionTitle>
            <p className="text-lg text-neutral-600 dark:text-dark-text-secondary">
              Upload your product catalog using CSV or XLSX format
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Upload Card */}
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <CardTitle>File Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Input */}
              <div>
                <label htmlFor="file" className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                  Select File <span className="text-primary-deep-red">*</span>
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
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Choose File
                  </Button>
                  {file && (
                    <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-surface border border-secondary-gray dark:border-dark-border rounded-lg">
                      <span className="text-sm text-neutral-900 dark:text-dark-text">{file.name}</span>
                      <span className="text-xs text-neutral-500 dark:text-dark-text-secondary">
                        ({(file.size / 1024).toFixed(2)} KB)
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-neutral-500 dark:text-dark-text-secondary">
                  Supported formats: CSV, XLSX (Max 10MB)
                </p>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                      Uploading...
                    </span>
                    <span className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary-gray dark:bg-dark-border rounded-full h-2">
                    <div
                      className="bg-primary-deep-red h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="flex-1 sm:flex-none"
                >
                  {uploading ? 'Uploading...' : 'Upload Catalog'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDownloadSample}
                  disabled={uploading}
                >
                  Download Sample CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload Report */}
          {report && (
            <Card variant="elevated" className="mb-8">
              <CardHeader>
                <CardTitle>Upload Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-success/10 border border-success">
                      <div className="text-2xl font-bold text-success mb-1">
                        {report.insertedCount}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                        Products Inserted
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-error/10 border border-error">
                      <div className="text-2xl font-bold text-error mb-1">
                        {report.failedCount}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                        Failed Records
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary-soft-blue/10 border border-secondary-soft-blue">
                      <div className="text-2xl font-bold text-secondary-soft-blue mb-1">
                        {report.totalRows}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                        Total Rows
                      </div>
                    </div>
                  </div>

                  {/* Failed Records */}
                  {report.failedRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text mb-4">
                        Failed Records
                      </h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {report.failedRecords.map((failed, index) => (
                          <div
                            key={index}
                            className="p-4 rounded-lg bg-error/5 border border-error/20"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-sm font-medium text-error">
                                Row {failed.row}
                              </span>
                            </div>
                            <div className="mb-2">
                              <p className="text-xs font-medium text-neutral-600 dark:text-dark-text-secondary mb-1">
                                Data:
                              </p>
                              <pre className="text-xs bg-white dark:bg-dark-surface p-2 rounded border border-secondary-gray dark:border-dark-border overflow-x-auto">
                                {JSON.stringify(failed.data, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-neutral-600 dark:text-dark-text-secondary mb-1">
                                Errors:
                              </p>
                              <ul className="list-disc list-inside text-xs text-error">
                                {failed.errors.map((err, errIndex) => (
                                  <li key={errIndex}>{err}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Message */}
                  {report.insertedCount > 0 && report.failedCount === 0 && (
                    <div className="p-4 rounded-lg bg-success/10 border border-success">
                      <p className="text-sm text-success font-medium">
                        ✓ All products uploaded successfully!
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              className="px-8"
            >
              Back
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

