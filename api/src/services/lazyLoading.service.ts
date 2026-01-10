import mongoose, { Model, Document, FilterQuery, SortOrder } from 'mongoose';

/**
 * Lazy Loading Service
 * 
 * PURPOSE:
 * - Provide efficient pagination for database queries
 * - Support both offset-based and cursor-based pagination
 * - Handle large datasets efficiently
 * - Provide lazy loading utilities
 * 
 * FEATURES:
 * - Offset-based pagination (page/limit)
 * - Cursor-based pagination (for better performance)
 * - Infinite scroll support
 * - Lazy loading helpers
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, SortOrder>;
}

export interface CursorPaginationOptions {
  cursor?: string; // Base64 encoded cursor
  limit?: number;
  sort?: Record<string, SortOrder>;
  sortField?: string; // Field to use for cursor (default: _id)
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    cursor: string | null; // Next cursor
    prevCursor: string | null; // Previous cursor
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    count: number;
  };
}

/**
 * Offset-based pagination (page/limit)
 * Best for: Small to medium datasets, when total count is needed
 */
export async function paginate<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
  } = options;

  const pageNum = Math.max(1, parseInt(String(page)));
  const limitNum = Math.max(1, Math.min(100, parseInt(String(limit)))); // Max 100 per page
  const skip = (pageNum - 1) * limitNum;

  // Execute queries in parallel
  const [data, total] = await Promise.all([
    model.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    model.countDocuments(filter),
  ]);

  const pages = Math.ceil(total / limitNum);

  return {
    data: data as T[],
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages,
      hasNext: pageNum < pages,
      hasPrev: pageNum > 1,
    },
  };
}

/**
 * Cursor-based pagination (for better performance on large datasets)
 * Best for: Large datasets, infinite scroll, when total count is not needed
 */
export async function paginateWithCursor<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: CursorPaginationOptions = {}
): Promise<CursorPaginationResult<T>> {
  const {
    cursor,
    limit: limitOption = 20,
    sort = { _id: 1 },
    sortField = '_id',
  } = options;

  const limitNum = Math.max(1, Math.min(100, parseInt(String(limitOption))));

  // Decode cursor
  let cursorValue: any = null;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      cursorValue = JSON.parse(decoded);
    } catch (error) {
      // Invalid cursor, start from beginning
      cursorValue = null;
    }
  }

  // Build query with cursor
  const query: FilterQuery<T> = { ...filter };
  
  if (cursorValue) {
    const sortDirection = Object.values(sort)[0] || 1;
    const sortOperator = sortDirection === 1 ? '$gt' : '$lt';
    (query as any)[sortField] = { [sortOperator]: cursorValue };
  }

  // Fetch one extra to check if there's a next page
  const results = await model
    .find(query)
    .sort(sort)
    .limit(limitNum + 1)
    .lean();

  const hasNext = results.length > limitNum;
  const data = hasNext ? results.slice(0, limitNum) : results;

  // Generate next cursor
  let nextCursor: string | null = null;
  if (hasNext && data.length > 0) {
    const lastItem = data[data.length - 1] as any;
    const cursorData = lastItem[sortField];
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  // Generate previous cursor (for reverse pagination)
  let prevCursor: string | null = null;
  if (cursorValue && data.length > 0) {
    const firstItem = data[0] as any;
    const cursorData = firstItem[sortField];
    prevCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  return {
    data: data as T[],
    pagination: {
      cursor: nextCursor,
      prevCursor,
      limit: limitNum,
      hasNext,
      hasPrev: !!cursorValue,
      count: data.length,
    },
  };
}

/**
 * Infinite scroll pagination (cursor-based with direction)
 */
export async function infiniteScroll<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: {
    cursor?: string;
    limit?: number;
    direction?: 'forward' | 'backward';
    sort?: Record<string, SortOrder>;
    sortField?: string;
  } = {}
): Promise<CursorPaginationResult<T>> {
  const {
    cursor,
    limit: limitOption = 20,
    direction = 'forward',
    sort = { _id: 1 },
    sortField = '_id',
  } = options;

  const limitNum = Math.max(1, Math.min(100, parseInt(String(limitOption))));

  // Decode cursor
  let cursorValue: any = null;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      cursorValue = JSON.parse(decoded);
    } catch (error) {
      cursorValue = null;
    }
  }

  // Build query
  const query: FilterQuery<T> = { ...filter };
  const sortDirection = Object.values(sort)[0] || 1;

  if (cursorValue) {
    if (direction === 'forward') {
      (query as any)[sortField] = sortDirection === 1 ? { $gt: cursorValue } : { $lt: cursorValue };
    } else {
      (query as any)[sortField] = sortDirection === 1 ? { $lt: cursorValue } : { $gt: cursorValue };
    }
  }

  // Reverse sort for backward pagination
  const actualSort = direction === 'backward' 
    ? Object.fromEntries(Object.entries(sort).map(([k, v]) => [k, (v === 1 ? -1 : 1) as SortOrder]))
    : sort;

  // Fetch one extra to check if there's more
  const results = await model
    .find(query)
    .sort(actualSort)
    .limit(limitNum + 1)
    .lean();

  // Reverse if backward
  const processedResults = direction === 'backward' ? results.reverse() : results;

  const hasNext = processedResults.length > limitNum;
  const data = hasNext ? processedResults.slice(0, limitNum) : processedResults;

  // Generate cursors
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;

  if (data.length > 0) {
    const lastItem = data[data.length - 1] as any;
    const firstItem = data[0] as any;

    if (hasNext) {
      nextCursor = Buffer.from(JSON.stringify(lastItem[sortField])).toString('base64');
    }

    if (cursorValue) {
      prevCursor = Buffer.from(JSON.stringify(firstItem[sortField])).toString('base64');
    }
  }

  return {
    data: data as T[],
    pagination: {
      cursor: nextCursor,
      prevCursor,
      limit: limitNum,
      hasNext,
      hasPrev: !!cursorValue,
      count: data.length,
    },
  };
}

/**
 * Lazy load with chunking (load data in chunks)
 */
export async function lazyLoadChunks<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: {
    chunkSize?: number;
    sort?: Record<string, SortOrder>;
    onChunk?: (chunk: T[]) => Promise<void>;
  } = {}
): Promise<{ total: number; chunks: number }> {
  const {
    chunkSize = 100,
    sort = { _id: 1 },
    onChunk,
  } = options;

  const total = await model.countDocuments(filter);
  const chunks = Math.ceil(total / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const skip = i * chunkSize;
    const chunk = await model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(chunkSize)
      .lean();

    if (onChunk) {
      await onChunk(chunk as T[]);
    }
  }

  return { total, chunks };
}

/**
 * Lazy load with streaming (for very large datasets)
 */
export async function* lazyLoadStream<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T> = {},
  options: {
    batchSize?: number;
    sort?: Record<string, SortOrder>;
  } = {}
): AsyncGenerator<T[], void, unknown> {
  const {
    batchSize = 100,
    sort = { _id: 1 },
  } = options;

  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(batchSize)
      .lean();

    if (batch.length === 0) {
      hasMore = false;
    } else {
      yield batch as T[];
      skip += batchSize;
      hasMore = batch.length === batchSize;
    }
  }
}

/**
 * Get pagination metadata from query parameters
 */
export function getPaginationParams(req: {
  query: {
    page?: string;
    limit?: string;
    cursor?: string;
    sort?: string;
  };
}): PaginationOptions {
  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 20;
  const sortStr = req.query.sort || '-createdAt';

  // Parse sort string (e.g., "-createdAt,name" -> { createdAt: -1, name: 1 })
  const sort: Record<string, SortOrder> = {};
  if (sortStr) {
    sortStr.split(',').forEach((field) => {
      const trimmed = field.trim();
      if (trimmed.startsWith('-')) {
        sort[trimmed.substring(1)] = -1;
      } else {
        sort[trimmed] = 1;
      }
    });
  }

  return { page, limit, sort };
}

/**
 * Get cursor pagination params from query
 */
export function getCursorPaginationParams(req: {
  query: {
    cursor?: string;
    limit?: string;
    sort?: string;
    sortField?: string;
  };
}): CursorPaginationOptions {
  const limit = req.query.limit ? parseInt(req.query.limit) : 20;
  const cursor = req.query.cursor || undefined;
  const sortStr = req.query.sort || '_id';
  const sortField = req.query.sortField || '_id';

  // Parse sort
  const sort: Record<string, SortOrder> = {};
  if (sortStr) {
    sortStr.split(',').forEach((field) => {
      const trimmed = field.trim();
      if (trimmed.startsWith('-')) {
        sort[trimmed.substring(1)] = -1;
      } else {
        sort[trimmed] = 1;
      }
    });
  }

  return { cursor, limit, sort, sortField };
}

