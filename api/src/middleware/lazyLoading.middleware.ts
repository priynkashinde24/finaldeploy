import { Request, Response, NextFunction } from 'express';
import {
  paginate,
  paginateWithCursor,
  infiniteScroll,
  getPaginationParams,
  getCursorPaginationParams,
} from '../services/lazyLoading.service';
import { sendSuccess } from '../utils/responseFormatter';
import { Model, Document, FilterQuery } from 'mongoose';

/**
 * Lazy Loading Middleware
 * 
 * PURPOSE:
 * - Automatically apply pagination to queries
 * - Support both offset and cursor-based pagination
 * - Add pagination metadata to responses
 */

export interface LazyLoadingOptions {
  useCursor?: boolean; // Use cursor-based pagination
  defaultLimit?: number;
  maxLimit?: number;
  sortField?: string;
}

/**
 * Middleware to add pagination to response
 * Automatically extracts pagination params from query and applies to model
 */
export function lazyLoadingMiddleware<T extends Document>(
  model: Model<T>,
  getFilter: (req: Request) => FilterQuery<T> = () => ({}),
  options: LazyLoadingOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { useCursor = false, defaultLimit = 20, maxLimit = 100 } = options;
      const filter = getFilter(req);

      if (useCursor) {
        // Cursor-based pagination
        const cursorParams = getCursorPaginationParams(req);
        const result = await paginateWithCursor(model, filter, {
          ...cursorParams,
          limit: Math.min(cursorParams.limit || defaultLimit, maxLimit),
        });

        sendSuccess(
          res,
          {
            data: result.data,
            pagination: result.pagination,
          },
          'Data retrieved'
        );
      } else {
        // Offset-based pagination
        const paginationParams = getPaginationParams(req);
        const result = await paginate(model, filter, {
          ...paginationParams,
          limit: Math.min(paginationParams.limit || defaultLimit, maxLimit),
        });

        sendSuccess(
          res,
          {
            data: result.data,
            pagination: result.pagination,
          },
          'Data retrieved'
        );
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware for infinite scroll (cursor-based with direction)
 */
export function infiniteScrollMiddleware<T extends Document>(
  model: Model<T>,
  getFilter: (req: Request) => FilterQuery<T> = () => ({}),
  options: LazyLoadingOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { defaultLimit = 20, maxLimit = 100, sortField } = options;
      const filter = getFilter(req);
      const cursorParams = getCursorPaginationParams(req);
      const direction = (req.query.direction as 'forward' | 'backward') || 'forward';

      const result = await infiniteScroll(model, filter, {
        cursor: cursorParams.cursor,
        limit: Math.min(cursorParams.limit || defaultLimit, maxLimit),
        direction,
        sort: cursorParams.sort,
        sortField: sortField || cursorParams.sortField,
      });

      sendSuccess(
        res,
        {
          data: result.data,
          pagination: result.pagination,
        },
        'Data retrieved'
      );
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper to add pagination to existing query result
 */
export function addPaginationMetadata<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
}

