import { Router } from 'express';
import {
  createUserByAdmin,
  listUsers,
  updateUserStatus,
  resetUserPassword,
  unlockUserAccount,
  approveUser,
  blockUser,
  updateUserRole,
  deleteUser,
} from '../controllers/adminUser.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['admin']));

// POST /api/admin/users - Create new user (supplier or reseller)
router.post('/users', createUserByAdmin);

// GET /api/admin/users - List all users with filters
router.get('/users', listUsers);

// PATCH /api/admin/users/:id/status - Update user status
router.patch('/users/:id/status', updateUserStatus);

// PATCH /api/admin/users/:id/reset-password - Reset user password
router.patch('/users/:id/reset-password', resetUserPassword);

// PATCH /api/admin/users/:id/unlock - Unlock user account
router.patch('/users/:id/unlock', unlockUserAccount);

// PATCH /api/admin/users/:id/approve - Approve user
router.patch('/users/:id/approve', approveUser);

// PATCH /api/admin/users/:id/block - Block user
router.patch('/users/:id/block', blockUser);

// PATCH /api/admin/users/:id/role - Update user role
router.patch('/users/:id/role', updateUserRole);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', deleteUser);

export default router;

