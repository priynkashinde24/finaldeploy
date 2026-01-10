'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { quickbooksExportAPI, storeAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function QuickBooksExportPage() {
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
      console.error('[QUICKBOOKS EXPORT] Load stores error:', err);
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

      const blob = await quickbooksExportAPI.exportTransactions({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        mode,
        includeReceipts,
        includeDiscountLedger,
        partyLedgerMode,
      });

      const filename = `quickbooks-export-${dateRange.startDate}-to-${dateRange.endDate}.iif`;
      download(blob, filename);
      setSuccess(`QuickBooks IIF file downloaded successfully: ${filename}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      console.error('[QUICKBOOKS EXPORT] Export error:', e);
      setError(e?.response?.data?.message || e?.message || 'Failed to export QuickBooks IIF file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">QuickBooks Accounting Export</h1>
          <p className="text-text-secondary">
            Export completed orders as QuickBooks-compatible IIF (Intuit Interchange Format) files
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
                <option value="customer">Customer (Individual customer accounts)</option>
                <option value="cash">Cash (Single cash account)</option>
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
                  Also export Deposit transactions (for payment collection)
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
              {loading ? 'Exporting...' : 'Download QuickBooks IIF File'}
            </Button>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">Account Names Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary mb-4 text-sm">
              The exported IIF file uses the following standard QuickBooks account names. Make sure these accounts exist in your QuickBooks company file:
            </p>
            <ul className="text-sm text-text-secondary list-disc pl-5 space-y-2">
              <li><strong className="text-white">Sales</strong> - Main sales income account</li>
              <li><strong className="text-white">Discount</strong> - Discount expense account (if enabled)</li>
              <li><strong className="text-white">Shipping Income</strong> - Shipping charges income account</li>
              <li><strong className="text-white">Sales Tax Payable - CGST</strong> - Central GST liability account</li>
              <li><strong className="text-white">Sales Tax Payable - SGST</strong> - State GST liability account</li>
              <li><strong className="text-white">Sales Tax Payable - IGST</strong> - Integrated GST liability account</li>
              <li><strong className="text-white">Sales Tax Payable - VAT</strong> - VAT liability account (if applicable)</li>
              <li><strong className="text-white">Accounts Receivable</strong> - Customer receivables (for customer mode)</li>
              <li><strong className="text-white">Cash</strong> - Cash account (for cash mode or daily consolidated)</li>
              <li><strong className="text-white">Cash Account / Stripe Account / PayPal Account</strong> - Payment method accounts (for deposits)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">How to Import in QuickBooks</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-text-secondary list-decimal pl-5 space-y-2">
              <li>Download the QuickBooks IIF file using the export button above</li>
              <li>Open QuickBooks Desktop (Pro, Premier, or Enterprise)</li>
              <li>Go to <strong className="text-white">File → Utilities → Import → IIF Files</strong></li>
              <li>Select the downloaded .iif file</li>
              <li>QuickBooks will import all invoice and deposit transactions</li>
              <li>Verify the transactions in <strong className="text-white">Customers → Transactions → Invoices</strong></li>
              <li>Check deposits in <strong className="text-white">Banking → Make Deposits</strong></li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">
                <strong>Note:</strong> Ensure all required accounts are created in QuickBooks before importing. The export includes only completed orders (confirmed/delivered status). IIF format is compatible with QuickBooks Desktop versions 2010 and later.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Format Information */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-white">About IIF Format</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary mb-3">
              IIF (Intuit Interchange Format) is a tab-delimited text format used by QuickBooks Desktop to import transactions. The exported file contains:
            </p>
            <ul className="text-sm text-text-secondary list-disc pl-5 space-y-2">
              <li><strong className="text-white">Invoice Transactions:</strong> Sales invoices with customer/account information</li>
              <li><strong className="text-white">Split Transactions:</strong> Line items for sales, discounts, shipping, and taxes</li>
              <li><strong className="text-white">Deposit Transactions:</strong> Payment deposits (if enabled) for cash collection</li>
            </ul>
            <p className="text-sm text-text-secondary mt-3">
              Each invoice includes proper debit/credit entries to balance the transaction according to double-entry accounting principles.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

