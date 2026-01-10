'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Footer } from '@/components/marketing';
import { orderMessageAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  _id: string;
  senderRole: 'customer' | 'admin' | 'supplier' | 'reseller' | 'system';
  senderId?: string;
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms';
  messageType: 'text' | 'attachment' | 'system_event';
  content: string;
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
  isRead: boolean;
  readBy: Array<{
    role: string;
    userId: string;
    readAt: string;
  }>;
  isInternal: boolean;
  createdAt: string;
}

interface Thread {
  _id: string;
  status: 'open' | 'closed';
  lastMessageAt: string;
  createdAt: string;
}

export default function OrderMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setError(null);
      const response = await orderMessageAPI.getMessages(orderId);
      if (response.success) {
        setMessages(response.data.messages || []);
        setThread(response.data.thread || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      setError(null);

      const response = await orderMessageAPI.createMessage(orderId, {
        content: newMessage.trim(),
        channel: 'in_app',
        messageType: 'text',
        isInternal: isInternal,
      });

      if (response.success) {
        setNewMessage('');
        setIsInternal(false);
        await fetchMessages();
      } else {
        setError(response.message || 'Failed to send message');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getSenderLabel = (senderRole: string) => {
    const labels: Record<string, string> = {
      customer: 'Customer',
      admin: 'Admin',
      supplier: 'Supplier',
      reseller: 'Reseller',
      system: 'System',
    };
    return labels[senderRole] || senderRole;
  };

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, string> = {
      in_app: '💬',
      email: '📧',
      whatsapp: '💚',
      sms: '📱',
    };
    return icons[channel] || '💬';
  };

  const getRoleColor = (senderRole: string) => {
    const colors: Record<string, string> = {
      customer: 'bg-blue-100 text-blue-800 border-blue-200',
      admin: 'bg-purple-100 text-purple-800 border-purple-200',
      supplier: 'bg-green-100 text-green-800 border-green-200',
      reseller: 'bg-orange-100 text-orange-800 border-orange-200',
      system: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[senderRole] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-8">
            <p className="text-gray-500">Loading messages...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <SectionTitle>Messages for Order {orderId}</SectionTitle>
          {thread && (
            <div className="mt-2">
              <span
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                  thread.status === 'open'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                )}
              >
                {thread.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="p-0">
            {/* Messages List */}
            <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={cn(
                      'flex flex-col space-y-1',
                      message.senderRole === 'customer' ? 'items-start' : 'items-end'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg p-3',
                        message.senderRole === 'customer'
                          ? 'bg-white border border-gray-200'
                          : 'bg-blue-50 border border-blue-200',
                        message.isInternal && 'bg-yellow-50 border-yellow-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border',
                              getRoleColor(message.senderRole)
                            )}
                          >
                            {getSenderLabel(message.senderRole)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getChannelIcon(message.channel)}
                          </span>
                          {message.isInternal && (
                            <span className="text-xs text-yellow-700 font-semibold">(Internal)</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 hover:text-blue-800"
                            >
                              📎 {att.filename}
                            </a>
                          ))}
                        </div>
                      )}
                      {!message.isRead && message.senderRole !== 'customer' && (
                        <div className="mt-1 text-xs text-gray-500">Unread</div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="space-y-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  disabled={sending || thread?.status === 'closed'}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={sending}
                    />
                    <span>Internal note (admin only)</span>
                  </label>
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim() || thread?.status === 'closed'}
                    className="px-6"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

