import { Router } from 'express';
import {
  createMessage,
  getMessages,
  markMessageRead,
  closeThread,
  searchMessages,
} from '../controllers/orderMessage.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';

const router = Router();

/**
 * Order Message Routes
 * 
 * All routes require authentication
 */

// Create message
router.post('/orders/:id/messages', authenticate, resolveStore, createMessage);

// Get messages
router.get('/orders/:id/messages', authenticate, resolveStore, getMessages);

// Mark message as read
router.patch('/orders/:id/messages/:messageId/read', authenticate, markMessageRead);

// Close thread (admin only)
router.patch('/orders/:id/thread/close', authenticate, closeThread);

// Search messages (admin only)
router.get('/admin/messages/search', authenticate, searchMessages);

export default router;

