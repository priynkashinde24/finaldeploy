'use client';

import React from 'react';
import { AuditLog } from '@/lib/auditLogs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface AuditLogDetailProps {
  log: AuditLog;
  onClose: () => void;
}

export const AuditLogDetail: React.FC<AuditLogDetailProps> = ({ log, onClose }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Log Details</CardTitle>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary">Action</label>
              <p className="text-white font-medium">{log.action}</p>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Entity Type</label>
              <p className="text-white font-medium">{log.entityType}</p>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Actor Role</label>
              <p className="text-white font-medium capitalize">{log.actorRole}</p>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Timestamp</label>
              <p className="text-white font-medium">{formatDate(log.createdAt)}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-text-secondary">Description</label>
            <p className="text-white mt-1">{log.description}</p>
          </div>

          {/* Actor Info */}
          {log.actor && (
            <div>
              <label className="text-sm text-text-secondary">Actor</label>
              <div className="mt-1 p-3 bg-[#1A1A1A] rounded-lg border border-[#242424]">
                <p className="text-white font-medium">{log.actor.name}</p>
                <p className="text-text-secondary text-sm">{log.actor.email}</p>
                <p className="text-text-secondary text-sm capitalize">{log.actor.role}</p>
              </div>
            </div>
          )}

          {/* Entity ID */}
          {log.entityId && (
            <div>
              <label className="text-sm text-text-secondary">Entity ID</label>
              <p className="text-white font-mono text-sm mt-1">{log.entityId}</p>
            </div>
          )}

          {/* IP Address */}
          <div>
            <label className="text-sm text-text-secondary">IP Address</label>
            <p className="text-white font-mono text-sm mt-1">{log.ipAddress}</p>
          </div>

          {/* User Agent */}
          <div>
            <label className="text-sm text-text-secondary">User Agent</label>
            <p className="text-white text-sm mt-1 break-all">{log.userAgent}</p>
          </div>

          {/* Metadata */}
          <div>
            <label className="text-sm text-text-secondary">Metadata</label>
            <pre className="mt-2 p-4 bg-[#1A1A1A] rounded-lg border border-[#242424] overflow-x-auto text-xs text-white">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

