export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly isOperational: boolean;

  constructor(code: string, message: string, httpStatus = 400, isOperational = true) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

// Helper to normalize unknown errors
export function toAppError(err: unknown, fallbackMessage = 'Internal Server Error'): AppError {
  if (err instanceof AppError) return err;
  return new AppError('INTERNAL_ERROR', fallbackMessage, 500, false);
}


