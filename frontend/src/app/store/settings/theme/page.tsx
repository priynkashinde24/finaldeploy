'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useThemeVariant } from '@/context/ThemeContext';
import { api } from '@/lib/api';

type ThemeVariantDto = {
  _id: string;
  name: string;
  code: string;
  layout?: { headerStyle?: string; footerStyle?: string; gridDensity?: string };
  components?: { buttonStyle?: string; cardStyle?: string; inputStyle?: string };
  spacing?: { baseSpacing?: number };
  animations?: { enabled?: boolean; intensity?: string };
  isActive?: boolean;
  version?: number;
  createdAt?: string;
};

export default function ThemeSettingsPage() {
  const themeCtx = useThemeVariant();
  const [variants, setVariants] = useState<ThemeVariantDto[]>([]);
  const [history, setHistory] = useState<ThemeVariantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const activeCode = useMemo(() => variants.find((v) => v.isActive)?.code, [variants]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [variantsRes, historyRes] = await Promise.all([
        api.get('/theme/variants'),
        api.get('/theme/history'),
      ]);
      setVariants(variantsRes.data?.data?.variants || []);
      setHistory(historyRes.data?.data?.history || []);
    } catch (err) {
      console.error('Failed to load theme data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyTheme = async (code: string) => {
    setActionCode(code);
    try {
      await api.post('/theme/apply', { code });
      await fetchData();
      setPreviewKey((k) => k + 1);
    } catch (err) {
      console.error('Apply theme failed', err);
    } finally {
      setActionCode(null);
    }
  };

  const rollbackTheme = async (version: number) => {
    setRollbackVersion(version);
    try {
      await api.post('/theme/rollback', { version });
      await fetchData();
      setPreviewKey((k) => k + 1);
    } catch (err) {
      console.error('Rollback failed', err);
    } finally {
      setRollbackVersion(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Theme Variants</h1>
          <p className="text-sm text-muted-foreground">
            Switch themes safely. Branding (colors/fonts) stays unchanged.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Active: <span className="font-semibold">{activeCode || 'none'}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {variants.map((variant) => (
          <div
            key={variant._id}
            className={`border rounded-lg p-4 space-y-3 ${variant.isActive ? 'border-primary' : 'border-neutral-800'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase text-muted-foreground">{variant.code}</p>
                <h3 className="text-lg font-semibold">{variant.name}</h3>
              </div>
              {variant.isActive && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">Active</span>
              )}
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>Header: {variant.layout?.headerStyle}</p>
              <p>Buttons: {variant.components?.buttonStyle}</p>
              <p>Spacing: {variant.spacing?.baseSpacing || 12}px</p>
              <p>Animations: {variant.animations?.intensity}</p>
            </div>
            <button
              onClick={() => applyTheme(variant.code)}
              disabled={variant.isActive || actionCode === variant.code}
              className="w-full rounded-md bg-primary text-white py-2 disabled:opacity-50"
            >
              {variant.isActive ? 'Active' : actionCode === variant.code ? 'Applying...' : 'Apply Theme'}
            </button>
          </div>
        ))}
        {variants.length === 0 && !loading && (
          <div className="col-span-3 text-sm text-muted-foreground">No themes available.</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Theme History</h2>
          <div className="border rounded-lg divide-y divide-neutral-800">
            {history.map((item) => (
              <div key={`${item.code}-${item.version}-${item._id}`} className="p-3 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-semibold">v{item.version} — {item.code}</p>
                  <p className="text-muted-foreground">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                <button
                  onClick={() => rollbackTheme(item.version || 0)}
                  disabled={rollbackVersion === item.version || item.isActive}
                  className="text-sm px-3 py-1 rounded-md border border-neutral-700 hover:border-primary disabled:opacity-50"
                >
                  {item.isActive ? 'Current' : rollbackVersion === item.version ? 'Reverting...' : 'Rollback'}
                </button>
              </div>
            ))}
            {history.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No history yet.</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Live Preview</h2>
          <div className="border rounded-lg overflow-hidden aspect-[4/3] bg-neutral-950">
            <iframe
              key={previewKey}
              title="Theme Preview"
              src="/storefront/preview"
              className="w-full h-full border-0"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Preview updates when you apply or rollback themes. Branding colors/fonts remain unchanged.
          </p>
        </div>
      </div>
    </div>
  );
}


