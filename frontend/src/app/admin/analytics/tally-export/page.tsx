'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tallyExportAPI } from '@/lib/api';

export default function AdminTallyExportPage() {
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
    try {
      setLoading(true);
      setError(null);
      if (mode === 'daily' && partyLedgerMode !== 'cash') {
        setError('Daily consolidated export requires Party Ledger Mode = Cash.');
        return;
      }
      const blob = await tallyExportAPI.exportSalesVouchers({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        mode,
        includeReceipts,
        includeDiscountLedger,
        partyLedgerMode,
      });
      download(blob, `tally-sales-${dateRange.startDate}-to-${dateRange.endDate}.xml`);
    } catch (e: any) {
      setError(e?.message || 'Failed to export Tally XML');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tally Export</h1>
          <p className="text-sm text-gray-600">
            Export completed orders as Tally Sales Vouchers (XML).
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Export Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="px-3 py-2 border rounded"
              >
                <option value="per_order">Per Order (1 voucher per order)</option>
                <option value="daily">Daily Consolidated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Party Ledger Mode</label>
              <select
                value={partyLedgerMode}
                onChange={(e) => setPartyLedgerMode(e.target.value as any)}
                className="px-3 py-2 border rounded"
              >
                <option value="customer">Customer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="discount-ledger"
                type="checkbox"
                checked={includeDiscountLedger}
                onChange={(e) => setIncludeDiscountLedger(e.target.checked)}
              />
              <label htmlFor="discount-ledger" className="text-sm">
                Include Discount ledger entry
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="include-receipts"
                type="checkbox"
                checked={includeReceipts}
                onChange={(e) => setIncludeReceipts(e.target.checked)}
              />
              <label htmlFor="include-receipts" className="text-sm">
                Also export Receipt vouchers
              </label>
            </div>
            <Button onClick={handleExport} disabled={loading}>
              {loading ? 'Exporting…' : 'Download Tally XML'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger Names Used</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
            <li>Sales</li>
            <li>Discount (optional)</li>
            <li>Shipping Charges</li>
            <li>Output CGST / Output SGST / Output IGST / Output VAT</li>
            <li>Round Off (only if needed to balance)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}


