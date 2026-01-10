'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUserSessions, adminRevokeSession, Session } from '@/lib/sessions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function AdminUserSessionsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (userId) {
      loadSessions();
    }
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUserSessions(userId);

      if (response.success && response.data) {
        setSessions(response.data.sessions);
      } else {
        setError(response.message || 'Failed to load sessions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async () => {
    if (!selectedSession) return;

    try {
      setRevoking(true);
      setError(null);
      const response = await adminRevokeSession(selectedSession.refreshTokenId);

      if (response.success) {
        setSuccessMessage('Session revoked successfully');
        setShowRevokeModal(false);
        setSelectedSession(null);
        loadSessions();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to revoke session');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke session');
    } finally {
      setRevoking(false);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            <h1 className="text-3xl font-bold text-white">User Sessions</h1>
          </div>
          <p className="text-text-secondary">View and manage sessions for user: {userId}</p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Sessions ({sessions.filter((s) => !s.revoked).length} active, {sessions.filter((s) => s.revoked).length} revoked)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No sessions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      session.revoked
                        ? 'bg-[#1A1A1A] border-red-500/30 opacity-60'
                        : 'bg-[#1A1A1A] border-[#242424] hover:border-[#333]'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">{session.deviceLabel}</h3>
                          {session.revoked ? (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-text-secondary">
                          <p>IP Address: {session.ipAddress}</p>
                          <p>Last Active: {formatDate(session.lastUsedAt)}</p>
                          <p>Created: {formatDate(session.createdAt)}</p>
                          <p className="text-xs font-mono text-text-muted">Token: {session.refreshTokenId.substring(0, 8)}...</p>
                        </div>
                      </div>
                      {!session.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSession(session);
                            setShowRevokeModal(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoke Session Modal */}
        <Modal
          isOpen={showRevokeModal}
          onClose={() => {
            setShowRevokeModal(false);
            setSelectedSession(null);
          }}
          title="Revoke Session"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-text-secondary">
              Are you sure you want to revoke this session? The user will be logged out from this device.
            </p>
            {selectedSession && (
              <div className="p-3 bg-[#1A1A1A] rounded-lg border border-[#242424]">
                <p className="text-sm text-white font-medium">{selectedSession.deviceLabel}</p>
                <p className="text-xs text-text-secondary mt-1">{selectedSession.ipAddress}</p>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={handleRevokeSession}
                disabled={revoking}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {revoking ? 'Revoking...' : 'Yes, Revoke'}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setShowRevokeModal(false);
                  setSelectedSession(null);
                }}
                disabled={revoking}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

