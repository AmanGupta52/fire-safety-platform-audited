import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { fail } from '../utils/apiResponse';

export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
      if (parsed.body) req.body = parsed.body;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(res, 'Validation failed', 422, err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message
        })));
      }
      next(err);
    }
  };
}
