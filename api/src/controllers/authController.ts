import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { comparePassword } from '../utils/password';
import { z } from 'zod';
import jwt, { SignOptions } from 'jsonwebtoken';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'supplier', 'reseller']),
});

// JWT token generation
const generateAccessToken = (userId: string, email: string, role: string): string => {
  const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';

  const payload = {
    userId,
    email,
    role,
  };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

const generateRefreshToken = (userId: string): string => {
  const JWT_REFRESH_SECRET: string =
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    'your-refresh-secret-key-change-in-production';
  const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  const payload = {
    userId,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
};

// Login handler
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user and include passwordHash field
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    // Set refresh token as HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return user data and access token
    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    sendSuccess(
      res,
      {
        accessToken,
        user: userData,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

// Register handler
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    const { name, email, password, role } = validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      sendError(res, 'User with this email already exists', 400);
      return;
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role,
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = generateRefreshToken(user._id.toString());

    // Set refresh token as HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return user data and access token
    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    sendSuccess(
      res,
      {
        accessToken,
        user: userData,
      },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
};

// Refresh token handler
export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      sendError(res, 'Refresh token not provided', 401);
      return;
    }

    const JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ||
      process.env.REFRESH_TOKEN_SECRET ||
      'your-refresh-secret-key-change-in-production';

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (error) {
      sendError(res, 'Invalid or expired refresh token', 401);
      return;
    }

    // Find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id.toString(), user.email, user.role);

    sendSuccess(
      res,
      {
        accessToken,
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    next(error);
  }
};

// Logout handler
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

