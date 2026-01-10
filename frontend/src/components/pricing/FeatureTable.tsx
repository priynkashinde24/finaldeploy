import React from 'react';

type Props = {
  features: string[];
  plans: { key: string; label: string; includes: boolean[] }[];
};

export default function FeatureTable({ features, plans }: Props) {
  return (
    <div className="overflow-x-auto mt-12">
      <table className="min-w-full text-left border-collapse">
        <thead>
          <tr className="text-sm text-muted border-b border-neutral-700">
            <th className="px-4 py-3 font-semibold">Features</th>
            {plans.map((p) => (
              <th key={p.key} className="px-6 py-3 font-semibold text-center">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((feat, i) => (
            <tr key={feat} className="border-b border-neutral-800 hover:bg-surface2 transition-colors">
              <td className="px-4 py-4 text-text">{feat}</td>
              {plans.map((p) => (
                <td key={p.key} className="px-6 py-4 text-center">
                  {p.includes[i] ? (
                    <span className="text-gold font-semibold text-lg">✓</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

