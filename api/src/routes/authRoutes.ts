import { Router } from 'express';
import { login, register, refresh, logout, sendMagicLink, magicLogin, sendOTP, verifyOTP } from '../controllers/auth.controller';
// import { loginRateLimiter, loginSlowDown, otpSendRateLimiter, otpVerifyRateLimiter } from '../middleware/rateLimit.auth'; // DISABLED FOR DEV
import { magicLinkRateLimiter } from '../middleware/rateLimit.auth';

const router = Router();

// POST /api/auth/login - Login user (with rate limiting and slow-down)
router.post('/login', login); // Rate limiters removed for dev

// POST /api/auth/register - Register new user
router.post('/register', register);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', refresh);

// POST /api/auth/logout - Logout user
router.post('/logout', logout);

// POST /api/auth/magic-link - Send magic link for passwordless login
router.post('/magic-link', magicLinkRateLimiter, sendMagicLink);

// GET /api/auth/magic-login - Validate magic link and auto-login
router.get('/magic-login', magicLogin);

// POST /api/auth/otp/send - Send OTP to phone number
router.post('/otp/send', sendOTP); // Rate limiter removed for dev

// POST /api/auth/otp/verify - Verify OTP and login
router.post('/otp/verify', verifyOTP); // Rate limiter removed for dev

export default router;

