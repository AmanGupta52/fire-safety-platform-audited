import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, errors: [] });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, errors: err.errors });
  }

  // Mongoose duplicate key error
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${keyValue ? Object.keys(keyValue).join(', ') : 'unknown'}`,
      errors: []
    });
  }

  // Mongoose validation error
  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => e.message);
    return res.status(422).json({ success: false, message: 'Validation failed', errors });
  }

  console.error('[error]', err);

  const message =
    env.nodeEnv === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  return res.status(500).json({
    success: false,
    message,
    errors: env.nodeEnv === 'production' ? [] : [{ stack: err instanceof Error ? err.stack : undefined }]
  });
}
