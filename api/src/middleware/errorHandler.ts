import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map((error) => ({
        field: error.path.join('.'),
        message: error.message,
      })),
    });
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values((err as any).errors).map((error: any) => ({
        field: error.path,
        message: error.message,
      })),
    });
    return;
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const keyPattern = (err as any).keyPattern || (err as any).keyValue || {};
    const field = Object.keys(keyPattern)[0] || 'duplicate';
    const fieldMessage =
      field === 'customDomain' || field === 'domain'
        ? 'This domain is already in use'
        : field === 'subdomain'
          ? 'This subdomain is already in use'
          : field === 'slug'
            ? 'This store slug is already in use'
            : field === 'code'
              ? 'This store code is already in use'
              : 'Duplicate value';
    res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      errors: [{ field, message: fieldMessage }],
    });
    return;
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

