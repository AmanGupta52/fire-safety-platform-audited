import { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function ok(res: Response, data: unknown = {}, message = 'Success', meta?: Meta, status = 200) {
  return res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}

export function created(res: Response, data: unknown = {}, message = 'Created') {
  return ok(res, data, message, undefined, 201);
}

export function fail(res: Response, message = 'Something went wrong', status = 400, errors: unknown[] = []) {
  return res.status(status).json({ success: false, message, errors });
}

export function paginationMeta(page: number, limit: number, total: number): Meta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
