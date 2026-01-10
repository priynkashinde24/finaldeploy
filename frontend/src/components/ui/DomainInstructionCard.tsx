import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { cn } from '@/lib/utils';

export interface DomainInstructionCardProps {
  recordType: string;
  recordName: string;
  recordValue: string;
  instruction: string;
  className?: string;
}

export const DomainInstructionCard: React.FC<DomainInstructionCardProps> = ({
  recordType,
  recordName,
  recordValue,
  instruction,
  className,
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <Card variant="elevated" className={cn('bg-secondary-off-white dark:bg-dark-background', className)}>
      <CardHeader>
        <CardTitle className="text-lg">DNS Configuration Instructions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-4">
            Add the following DNS record to your domain's DNS settings:
          </p>
          
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg border border-secondary-gray dark:border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                Record Type:
              </span>
              <code className="px-2 py-1 bg-secondary-off-white dark:bg-dark-background rounded text-sm font-mono">
                {recordType}
              </code>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                Record Name:
              </span>
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-secondary-off-white dark:bg-dark-background rounded text-sm font-mono">
                  {recordName}
                </code>
                <button
                  onClick={() => copyToClipboard(recordName)}
                  className="text-primary-deep-red hover:text-[#8A0000] text-xs"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
            
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary pt-1">
                Record Value:
              </span>
              <div className="flex items-center gap-2 max-w-[70%]">
                <code className="px-2 py-1 bg-secondary-off-white dark:bg-dark-background rounded text-sm font-mono break-all">
                  {recordValue}
                </code>
                <button
                  onClick={() => copyToClipboard(recordValue)}
                  className="text-primary-deep-red hover:text-[#8A0000] text-xs flex-shrink-0"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-secondary-gray dark:border-dark-border">
          <p className="text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
            Quick Instruction:
          </p>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary font-mono bg-white dark:bg-dark-surface p-3 rounded border border-secondary-gray dark:border-dark-border">
            {instruction}
          </p>
        </div>

        <div className="pt-4 border-t border-secondary-gray dark:border-dark-border">
          <p className="text-xs text-neutral-500 dark:text-dark-text-secondary">
            <strong>Note:</strong> DNS changes can take up to 48 hours to propagate. After adding the record, 
            click "Verify Domain" to check the status.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

