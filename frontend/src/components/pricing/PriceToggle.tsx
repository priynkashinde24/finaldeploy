import React from 'react';
import { motion } from 'framer-motion';

type Props = {
  yearly: boolean;
  onToggle: () => void;
};

export default function PriceToggle({ yearly, onToggle }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="text-sm text-muted">Monthly</span>
      <button
        aria-pressed={yearly}
        aria-label="Toggle billing period"
        onClick={onToggle}
        className="relative inline-flex items-center h-8 w-16 rounded-full bg-neutral-700 p-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
          className="h-6 w-6 rounded-full bg-white shadow"
          style={{ x: yearly ? 32 : 0 }}
        />
      </button>
      <span className="text-sm text-muted">
        Yearly <span className="ml-2 text-xs text-gold">save 20%</span>
      </span>
    </div>
  );
}

