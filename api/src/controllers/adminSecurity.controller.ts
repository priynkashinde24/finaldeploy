import { Request, Response, NextFunction } from 'express';
import { SecurityEvent } from '../models/SecurityEvent';
import { sendSuccess, sendError } from '../utils/responseFormatter';

export const listSecurityEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      sendError(res, 'Only admins can view security events', 403);
      return;
    }

    const {
      storeId,
      eventType,
      severity,
      ipAddress,
      dateFrom,
      dateTo,
      page = '1',
      limit = '50',
    } = req.query;

    const filter: any = {};
    if (storeId) filter.storeId = storeId;
    if (eventType) filter.eventType = eventType;
    if (severity) filter.severity = severity;
    if (ipAddress) filter.ipAddress = ipAddress;

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      SecurityEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      SecurityEvent.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      {
        events,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Security events fetched successfully'
    );
  } catch (error) {
    next(error);
  }
};


