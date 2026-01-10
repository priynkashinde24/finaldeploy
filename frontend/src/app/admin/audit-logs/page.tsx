'use client';

import React, { useState, useEffect } from 'react';
import { getAuditLogs, AuditLog, AuditLogFilters } from '@/lib/auditLogs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { AuditLogDetail } from '@/components/admin/AuditLogDetail';
import { cn } from '@/lib/utils';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Detail view
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryFilters: AuditLogFilters = {
        ...filters,
        action: actionFilter || undefined,
        entityType: entityTypeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const response = await getAuditLogs(queryFilters);

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || 'Failed to load audit logs');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    setFilters({ ...filters, page: 1 });
    loadLogs();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('FAILED') || action.includes('DISABLED') || action.includes('REVOKED')) {
      return 'text-red-400';
    }
    if (action.includes('SUCCESS') || action.includes('ENABLED') || action.includes('VERIFIED')) {
      return 'text-green-400';
    }
    if (action.includes('CREATED') || action.includes('SENT') || action.includes('ACCEPTED')) {
      return 'text-[#D4AF37]';
    }
    return 'text-white';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
          <p className="text-text-secondary">Track all critical actions across the platform</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Action</label>
                <Input
                  type="text"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  placeholder="e.g. LOGIN_SUCCESS"
                  onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Entity Type</label>
                <Input
                  type="text"
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  placeholder="e.g. User, Session"
                  onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Date From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Date To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="sm" onClick={handleFilterChange}>
                Apply Filters
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionFilter('');
                  setEntityTypeFilter('');
                  setDateFrom('');
                  setDateTo('');
                  setFilters({ page: 1, limit: 50 });
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Audit Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading audit logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No audit logs found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-[#121212] z-10">
                      <tr className="border-b border-[#242424]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Actor</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Action</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">Entity</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-white">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-[#242424] hover:bg-[#1A1A1A] transition-colors cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="py-3 px-4 text-text-secondary text-sm">{formatDate(log.createdAt)}</td>
                          <td className="py-3 px-4 text-white">
                            {log.actor ? (
                              <div>
                                <p className="font-medium">{log.actor.name}</p>
                                <p className="text-xs text-text-secondary">{log.actor.email}</p>
                              </div>
                            ) : (
                              <span className="text-text-secondary">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded text-xs font-semibold capitalize bg-[#D4AF37]/20 text-[#D4AF37]">
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn('font-medium', getActionColor(log.action))}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-sm">
                            {log.entityType}
                            {log.entityId && (
                              <p className="text-xs text-text-muted font-mono">{log.entityId.substring(0, 8)}...</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-text-secondary text-sm font-mono">{log.ipAddress}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#242424]">
                    <p className="text-sm text-text-secondary">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        {selectedLog && (
          <AuditLogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </div>
    </div>
  );
}

