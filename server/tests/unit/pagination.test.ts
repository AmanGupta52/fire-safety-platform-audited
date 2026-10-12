import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { intParam, parsePagination } from '../../src/utils/pagination';

const req = (query: Record<string, unknown>) => ({ query }) as unknown as Request;

describe('intParam', () => {
  const opts = { def: 10, max: 100 };
  it('uses the default for missing, empty, non-numeric, NaN, infinite and negative values', () => {
    for (const v of [undefined, '', '   ', 'abc', 'NaN', 'Infinity', '-5', '0', {}, null]) {
      expect(intParam(v, opts)).toBe(10);
    }
  });
  it('accepts normal values, truncates fractions and clamps to the maximum', () => {
    expect(intParam('25', opts)).toBe(25);
    expect(intParam('2.9', opts)).toBe(2);
    expect(intParam('999999', opts)).toBe(100);
  });
  it('uses the first value of a repeated parameter and ignores nested objects', () => {
    expect(intParam(['7', '9'], opts)).toBe(7);
    expect(intParam({ $gt: '1' }, opts)).toBe(10);
  });
});

describe('parsePagination', () => {
  it('defaults to page 1, limit 20, skip 0', () => {
    expect(parsePagination(req({}))).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  it('computes skip from page and limit', () => {
    expect(parsePagination(req({ page: '3', limit: '25' }))).toEqual({ page: 3, limit: 25, skip: 50 });
  });
  it('clamps the limit to maxLimit and falls back on a bad page or limit', () => {
    expect(parsePagination(req({ limit: '5000' }), { maxLimit: 50 }).limit).toBe(50);
    expect(parsePagination(req({ page: '-2', limit: 'abc' }), { defaultLimit: 10, maxLimit: 50 })).toEqual({ page: 1, limit: 10, skip: 0 });
  });
  it('never lets the default exceed the maximum', () => {
    expect(parsePagination(req({}), { defaultLimit: 500, maxLimit: 100 }).limit).toBe(100);
  });
});
