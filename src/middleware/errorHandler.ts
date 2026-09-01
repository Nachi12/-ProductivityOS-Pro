import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || err.status || 500;
  console.error(`[Error] ${req.method} ${req.url} - ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
}
