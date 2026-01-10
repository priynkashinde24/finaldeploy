import mongoose, { ClientSession } from 'mongoose';

/**
 * Run a function within a MongoDB transaction.
 * Ensures atomicity for critical multi-write flows.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  let result: T;
  try {
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    // @ts-expect-error result is assigned inside transaction
    return result;
  } finally {
    await session.endSession();
  }
}


