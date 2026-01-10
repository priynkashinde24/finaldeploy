'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMySessions, revokeSession, revokeAllSessions, Session } from '@/lib/sessions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMySessions();

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
      const response = await revokeSession(selectedSession.refreshTokenId);

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

  const handleRevokeAll = async () => {
    try {
      setRevoking(true);
      setError(null);
      const response = await revokeAllSessions();

      if (response.success) {
        setSuccessMessage('All other sessions revoked successfully');
        setShowRevokeAllModal(false);
        loadSessions();
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to revoke sessions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to revoke sessions');
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
          <h1 className="text-3xl font-bold text-white mb-2">Active Sessions</h1>
          <p className="text-text-secondary">Manage your active login sessions</p>
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
            <div className="flex items-center justify-between">
              <CardTitle>Your Sessions ({sessions.length})</CardTitle>
              {sessions.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRevokeAllModal(true)}
                >
                  Logout All Devices
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#B00000] mx-auto mb-4"></div>
                <p className="text-text-secondary">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">No active sessions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      session.isCurrent
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30'
                        : 'bg-[#1A1A1A] border-[#242424] hover:border-[#333]'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">{session.deviceLabel}</h3>
                          {session.isCurrent && (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-[#D4AF37]/20 text-[#D4AF37]">
                              Current Session
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-text-secondary">
                          <p>IP Address: {session.ipAddress}</p>
                          <p>Last Active: {formatDate(session.lastUsedAt)}</p>
                          <p>Created: {formatDate(session.createdAt)}</p>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSession(session);
                            setShowRevokeModal(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          Logout
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
              Are you sure you want to logout from this device?
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
                {revoking ? 'Revoking...' : 'Yes, Logout'}
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

        {/* Revoke All Sessions Modal */}
        <Modal
          isOpen={showRevokeAllModal}
          onClose={() => setShowRevokeAllModal(false)}
          title="Logout All Devices"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-text-secondary">
              Are you sure you want to logout from all other devices? You will remain logged in on this device.
            </p>
            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={handleRevokeAll}
                disabled={revoking}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {revoking ? 'Revoking...' : 'Yes, Logout All'}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowRevokeAllModal(false)}
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

