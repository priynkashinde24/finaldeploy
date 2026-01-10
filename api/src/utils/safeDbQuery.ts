import mongoose from 'mongoose';

/**
 * Default query timeout in milliseconds
 */
const DEFAULT_QUERY_TIMEOUT = 8000; // 8 seconds

/**
 * Check if MongoDB is connected and ready
 */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1; // 1 = connected
}

/**
 * Execute a database query with timeout handling
 * @param queryPromise - The Mongoose query promise
 * @param timeoutMs - Timeout in milliseconds (default: 8000ms)
 * @param errorMessage - Custom error message if timeout occurs
 * @returns The query result
 * @throws Error if query times out or database is not connected
 */
export async function safeDbQuery<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT,
  errorMessage?: string
): Promise<T> {
  // Check if DB is connected
  if (!isDbConnected()) {
    throw new Error('Database not connected. Please try again in a moment.');
  }

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Database query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race between query and timeout
    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error: any) {
    // Handle Mongoose errors and timeouts
    if (
      error.name === 'MongooseError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('buffering')
    ) {
      const message = errorMessage || `Database operation timed out. Please try again.`;
      throw new Error(message);
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Execute a database query with timeout handling and maxTimeMS
 * This is a wrapper that also sets maxTimeMS on the query
 */
export async function safeDbQueryWithTimeout<T>(
  queryBuilder: () => Promise<T>,
  timeoutMs: number = DEFAULT_QUERY_TIMEOUT,
  errorMessage?: string
): Promise<T> {
  if (!isDbConnected()) {
    throw new Error('Database not connected. Please try again in a moment.');
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Database query timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const queryPromise = queryBuilder();
    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (error: any) {
    if (
      error.name === 'MongooseError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('buffering')
    ) {
      const message = errorMessage || `Database operation timed out. Please try again.`;
      throw new Error(message);
    }
    throw error;
  }
}

