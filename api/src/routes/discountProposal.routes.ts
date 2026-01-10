import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore';
import {
  getDiscountProposals,
  getDiscountProposal,
  approveDiscountProposal,
  rejectDiscountProposal,
  generateDiscountProposals,
  getDiscountRules,
  createOrUpdateDiscountRule,
} from '../controllers/discountProposal.controller';

const router = Router();

/**
 * Discount Proposal Routes
 * 
 * All routes require authentication and store resolution
 */

// GET /discount-proposals - Get discount proposals
router.get('/discount-proposals', authenticate, resolveStore, getDiscountProposals);

// GET /discount-proposals/:id - Get single discount proposal
router.get('/discount-proposals/:id', authenticate, resolveStore, getDiscountProposal);

// PATCH /discount-proposals/:id/approve - Approve proposal
router.patch('/discount-proposals/:id/approve', authenticate, resolveStore, approveDiscountProposal);

// PATCH /discount-proposals/:id/reject - Reject proposal
router.patch('/discount-proposals/:id/reject', authenticate, resolveStore, rejectDiscountProposal);

// POST /discount-proposals/generate - Generate proposals for eligible alerts
router.post('/discount-proposals/generate', authenticate, resolveStore, generateDiscountProposals);

// GET /discount-rules - Get discount rules
router.get('/discount-rules', authenticate, resolveStore, getDiscountRules);

// POST /discount-rules - Create or update discount rule
router.post('/discount-rules', authenticate, resolveStore, createOrUpdateDiscountRule);

export default router;

