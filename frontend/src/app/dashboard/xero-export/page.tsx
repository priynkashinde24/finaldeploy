'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { xeroExportAPI, storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function XeroExportPage() {
  const router = useRouter();
  const user = getCurrentUser();

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [mode, setMode] = useState<'per_order' | 'daily'>('per_order');
  const [includeReceipts, setIncludeReceipts] = useState(false);
  const [includeDiscountLedger, setIncludeDiscountLedger] = useState(true);
  const [partyLedgerMode, setPartyLedgerMode] = useState<'customer' | 'cash'>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [userStores, setUserStores] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadStores = async () => {
    try {
      const resp = await storeAPI.getByOwner(user!.id);
      const stores = resp?.data || [];
      setUserStores(Array.isArray(stores) ? stores : []);

      // Auto-select first store or use stored selection
      if (stores.length > 0) {
        const storedStoreId = localStorage.getItem('storeId');
        const firstStoreId = stores[0]._id || stores[0].id;
        const storeIdToUse = storedStoreId && stores.some((s: any) => (s._id || s.id) === storedStoreId)
          ? storedStoreId
          : firstStoreId;
        setSelectedStoreId(storeIdToUse);
        localStorage.setItem('storeId', storeIdToUse);
      } else {
        setError('No stores found. Please create a store first.');
      }
    } catch (err: any) {
      console.error('[XERO EXPORT] Load stores error:', err);
      setError('Failed to load stores');
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExport = async () => {
    if (!selectedStoreId) {
      setError('Please select a store');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validation: Daily mode requires cash party ledger mode
      if (mode === 'daily' && partyLedgerMode !== 'cash') {
        setError('Daily consolidated export requires Party Ledger Mode = Cash.');
        setLoading(false);
        return;
      }

      const blob = await xeroExportAPI.exportTransactions({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        mode,
        includeReceipts,
        includeDiscountLedger,
        partyLedgerMode,
      });

      const filename = `xero-export-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      download(blob, filename);
      setSuccess(`Xero CSV file downloaded successfully: ${filename}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      console.error('[XERO EXPORT] Export error:', e);
      setError(e?.response?.data?.message || e?.message || 'Failed to export Xero CSV file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Xero Accounting Export</h1>
          <p className="text-text-secondary">
            Export completed orders as Xero-compatible CSV files for invoice import
          </p>
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
                <div className="font-semibold text-green-400">Success</div>
                <div className="text-sm text-green-300">{success}</div>
              </div>
            </div>
          </div>
        )}

        {/* Export Settings Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Export Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Store Selection */}
            {userStores.length > 1 && (
              <div>
                <label htmlFor="store-select" className="text-text-secondary mb-2 block text-sm font-medium">
                  Select Store
                </label>
                <select
                  id="store-select"
                  value={selectedStoreId || ''}
                  onChange={(e) => {
                    const storeId = e.target.value;
                    setSelectedStoreId(storeId);
                    localStorage.setItem('storeId', storeId);
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {userStores.map((store: any) => (
                    <option key={store._id || store.id} value={store._id || store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="text-text-secondary mb-2 block text-sm font-medium">
                  Start Date
                </label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="end-date" className="text-text-secondary mb-2 block text-sm font-medium">
                  End Date
                </label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Export Mode */}
            <div>
              <label htmlFor="export-mode" className="text-text-secondary mb-2 block text-sm font-medium">
                Export Mode
              </label>
              <select
                id="export-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="per_order">Per Order (1 invoice per order)</option>
                <option value="daily">Daily Consolidated (1 invoice per day)</option>
              </select>
              <p className="text-xs text-text-muted mt-1">
                {mode === 'daily' && 'Note: Daily mode requires Party Ledger Mode = Cash'}
              </p>
            </div>

            {/* Party Ledger Mode */}
            <div>
              <label htmlFor="party-ledger-mode" className="text-text-secondary mb-2 block text-sm font-medium">
                Party Ledger Mode
              </label>
              <select
                id="party-ledger-mode"
                value={partyLedgerMode}
                onChange={(e) => setPartyLedgerMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={mode === 'daily'} // Disable if daily mode (must be cash)
              >
                <option value="customer">Customer (Individual customer contacts)</option>
                <option value="cash">Cash (Single cash sales contact)</option>
              </select>
              {mode === 'daily' && (
                <p className="text-xs text-yellow-400 mt-1">
                  Party Ledger Mode is automatically set to Cash for daily consolidated exports
                </p>
              )}
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  id="discount-ledger"
                  type="checkbox"
                  checked={includeDiscountLedger}
                  onChange={(e) => setIncludeDiscountLedger(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="discount-ledger" className="text-text-secondary cursor-pointer text-sm">
                  Include Discount account entry
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="include-receipts"
                  type="checkbox"
                  checked={includeReceipts}
                  onChange={(e) => setIncludeReceipts(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="include-receipts" className="text-text-secondary cursor-pointer text-sm">
                  Also export Payment transactions (for payment collection)
                </label>
              </div>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={loading || !selectedStoreId}
              variant="primary"
              className="w-full"
              size="lg"
            >
              {loading ? 'Exporting...' : 'Download Xero CSV File'}
            </Button>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Account Codes Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary mb-4 text-sm">
              The exported CSV file uses the following default account codes. You may need to update these in the CSV file to match your Xero chart of accounts:
            </p>
            <ul className="text-sm text-text-secondary list-disc pl-5 space-y-2">
              <li><strong className="text-white">200</strong> - Sales account (default)</li>
              <li><strong className="text-white">400</strong> - Discount expense account (if enabled)</li>
              <li><strong className="text-white">201</strong> - Shipping Income account</li>
              <li><strong className="text-white">090</strong> - Cash/Bank account (for payments)</li>
              <li><strong className="text-white">091</strong> - PayPal account (for PayPal payments)</li>
              <li><strong className="text-white">092</strong> - Stripe account (for Stripe payments)</li>
            </ul>
            <p className="text-sm text-text-secondary mt-4">
              <strong className="text-white">Note:</strong> These are default codes. Please update the AccountCode column in the CSV file to match your Xero chart of accounts before importing.
            </p>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">How to Import in Xero</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-text-secondary list-decimal pl-5 space-y-2">
              <li>Download the Xero CSV file using the export button above</li>
              <li>Open Xero and navigate to <strong className="text-white">Accounting → Sales → Invoices</strong></li>
              <li>Click <strong className="text-white">Import</strong> or <strong className="text-white">Bulk Import</strong></li>
              <li>Select the downloaded CSV file</li>
              <li>Map the CSV columns to Xero fields (if required)</li>
              <li>Review and confirm the import</li>
              <li>Xero will create invoices for all transactions in the file</li>
              <li>Verify the invoices in <strong className="text-white">Sales → Invoices</strong></li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                <strong>Important:</strong> Before importing, ensure that:
              </p>
              <ul className="text-xs text-yellow-400 mt-2 list-disc pl-5 space-y-1">
                <li>All account codes in the CSV match your Xero chart of accounts</li>
                <li>All contacts (customers) exist in Xero, or Xero will create them automatically</li>
                <li>Tax types (GST, VAT, etc.) are configured in your Xero organization settings</li>
                <li>The CSV file only contains completed orders (confirmed/delivered status)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Format Information */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">About Xero CSV Format</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary mb-3">
              The exported CSV file follows Xero's standard invoice import format and includes:
            </p>
            <ul className="text-sm text-text-secondary list-disc pl-5 space-y-2">
              <li><strong className="text-white">Contact Information:</strong> Customer name and email address</li>
              <li><strong className="text-white">Invoice Details:</strong> Invoice number, date, due date, reference</li>
              <li><strong className="text-white">Line Items:</strong> Description, quantity, unit amount, account code</li>
              <li><strong className="text-white">Tax Information:</strong> Tax type (GST, VAT, etc.) based on order tax breakdown</li>
              <li><strong className="text-white">Status:</strong> All invoices are set to AUTHORISED status</li>
            </ul>
            <p className="text-sm text-text-secondary mt-3">
              Each order is exported as one or more invoice line items (sales, discount, shipping) with proper account codes and tax types.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

