import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { sendSuccess, sendError } from '../utils/responseFormatter';

export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { supplierId, category, status, limit, skip } = req.query;

    const query: any = {};

    if (supplierId) {
      query.supplierId = supplierId as string;
    }

    if (category) {
      query.category = category as string;
    }

    if (status) {
      query.status = status as string;
    }

    const limitNum = limit ? parseInt(limit as string) : 50;
    const skipNum = skip ? parseInt(skip as string) : 0;

    const products = await Product.find(query)
      .limit(limitNum)
      .skip(skipNum)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    sendSuccess(
      res,
      {
        products,
        total,
        limit: limitNum,
        skip: skipNum,
      },
      'Products retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

