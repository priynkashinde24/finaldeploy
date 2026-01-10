import { Request } from 'express';
import {
  paginate,
  paginateWithCursor,
  infiniteScroll,
  PaginationOptions,
  CursorPaginationOptions,
} from '../services/lazyLoading.service';
import { Model, Document, FilterQuery } from 'mongoose';

/**
 * Lazy Loading Helpers
 * 
 * PURPOSE:
 * - Convenience functions for common lazy loading patterns
 * - Simplify pagination in controllers
 * - Provide reusable query patterns
 */

/**
 * Paginate with automatic filter extraction
 */
export async function lazyLoadWithPagination<T extends Document>(
  model: Model<T>,
  req: Request,
  baseFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const { page = 1, limit = 20 } = req.query;
  const options: PaginationOptions = {
    page: parseInt(String(page)),
    limit: parseInt(String(limit)),
  };

  return paginate(model, baseFilter, options);
}

/**
 * Paginate with cursor (for infinite scroll)
 */
export async function lazyLoadWithCursor<T extends Document>(
  model: Model<T>,
  req: Request,
  baseFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    cursor: string | null;
    prevCursor: string | null;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    count: number;
  };
}> {
  const { cursor, limit = 20 } = req.query;
  const options: CursorPaginationOptions = {
    cursor: cursor as string | undefined,
    limit: parseInt(String(limit)),
  };

  return paginateWithCursor(model, baseFilter, options);
}

/**
 * Lazy load with store filter (multi-tenant)
 */
export async function lazyLoadForStore<T extends Document>(
  model: Model<T>,
  req: Request,
  storeId: string | null,
  additionalFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const filter: FilterQuery<T> = { ...additionalFilter };
  if (storeId) {
    (filter as any).storeId = storeId;
  }

  return lazyLoadWithPagination(model, req, filter);
}

/**
 * Lazy load with user filter
 */
export async function lazyLoadForUser<T extends Document>(
  model: Model<T>,
  req: Request,
  userId: string | null,
  additionalFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const filter: FilterQuery<T> = { ...additionalFilter };
  if (userId) {
    (filter as any).userId = userId;
  }

  return lazyLoadWithPagination(model, req, filter);
}

/**
 * Lazy load with date range filter
 */
export async function lazyLoadWithDateRange<T extends Document>(
  model: Model<T>,
  req: Request,
  dateField: string = 'createdAt',
  baseFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const { startDate, endDate } = req.query;
  const filter: FilterQuery<T> = { ...baseFilter };

  if (startDate || endDate) {
    (filter as any)[dateField] = {};
    if (startDate) {
      (filter as any)[dateField].$gte = new Date(startDate as string);
    }
    if (endDate) {
      (filter as any)[dateField].$lte = new Date(endDate as string);
    }
  }

  return lazyLoadWithPagination(model, req, filter);
}

/**
 * Lazy load with search filter
 */
export async function lazyLoadWithSearch<T extends Document>(
  model: Model<T>,
  req: Request,
  searchFields: string[],
  baseFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const { search } = req.query;
  const filter: FilterQuery<T> = { ...baseFilter };

  if (search && searchFields.length > 0) {
    const searchRegex = { $regex: search as string, $options: 'i' };
    if (searchFields.length === 1) {
      (filter as any)[searchFields[0]] = searchRegex;
    } else {
      (filter as any).$or = searchFields.map((field) => ({
        [field]: searchRegex,
      }));
    }
  }

  return lazyLoadWithPagination(model, req, filter);
}

/**
 * Lazy load with status filter
 */
export async function lazyLoadWithStatus<T extends Document>(
  model: Model<T>,
  req: Request,
  statusField: string = 'status',
  baseFilter: FilterQuery<T> = {}
): Promise<{
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> {
  const { status } = req.query;
  const filter: FilterQuery<T> = { ...baseFilter };

  if (status) {
    (filter as any)[statusField] = status;
  }

  return lazyLoadWithPagination(model, req, filter);
}

