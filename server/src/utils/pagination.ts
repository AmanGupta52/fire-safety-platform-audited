import { Request } from 'express';

interface IntParamOptions {
  /** Used when the value is missing, not a number, or below `min`. */
  def: number;
  min?: number;
  /** Values above this are clamped down to it. */
  max: number;
}

/**
 * Reads one integer query parameter defensively. Missing, empty, non-numeric, NaN/Infinity and
 * below-minimum values (including negatives) fall back to `def`; values above `max` are clamped to
 * `max`; fractions are truncated. A repeated parameter (`?limit=1&limit=2`) uses its first value.
 * It never throws, so a hostile query string can't turn into a 500.
 */
export function intParam(value: unknown, { def, min = 1, max }: IntParamOptions): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.trim() === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  const whole = Math.trunc(n);
  if (whole < min) return def;
  return Math.min(whole, max);
}

const MAX_PAGE = 100_000;

/**
 * Shared `?page=&limit=` parsing for every list endpoint: page >= 1, limit between 1 and `maxLimit`
 * (default `defaultLimit`). Returns the values to hand to `paginationMeta()` plus the `skip` offset.
 */
export function parsePagination(
  req: Request,
  { defaultLimit = 20, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {}
): { page: number; limit: number; skip: number } {
  const page = intParam(req.query.page, { def: 1, max: MAX_PAGE });
  const limit = intParam(req.query.limit, { def: Math.min(defaultLimit, maxLimit), max: maxLimit });
  return { page, limit, skip: (page - 1) * limit };
}
