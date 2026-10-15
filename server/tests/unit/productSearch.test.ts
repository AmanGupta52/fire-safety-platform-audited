import { describe, it, expect } from 'vitest';
import { parseSearchQuery, buildSearchFilter, MAX_QUERY_LENGTH, MAX_TOKENS, MAX_TOKEN_LENGTH } from '../../src/utils/productSearch';

describe('parseSearchQuery', () => {
  it('trims, collapses spaces and splits into lower-case words', () => {
    expect(parseSearchQuery('  ABC   Dry  Powder ')).toEqual({ phrase: 'ABC Dry Powder', tokens: ['abc', 'dry', 'powder'] });
  });
  it('returns nothing for empty or non-string input (arrays and objects from ?q[]= / ?q[$ne]= are ignored)', () => {
    for (const bad of [undefined, null, '', '   ', ['a', 'b'], { $ne: 'x' }, 42]) {
      expect(parseSearchQuery(bad)).toEqual({ phrase: '', tokens: [] });
    }
  });
  it('caps the length, the number of words and the length of each word', () => {
    expect(parseSearchQuery('x'.repeat(500)).phrase).toHaveLength(MAX_QUERY_LENGTH);
    const many = parseSearchQuery(Array.from({ length: 30 }, (_, i) => `w${i}`).join(' '));
    expect(many.tokens.length).toBeLessThanOrEqual(MAX_TOKENS);
    expect(parseSearchQuery('y'.repeat(90)).tokens[0]).toHaveLength(MAX_TOKEN_LENGTH);
  });
});

describe('buildSearchFilter', () => {
  it('is empty for no words', () => {
    expect(buildSearchFilter([])).toEqual({});
  });
  it('requires every word, each matched against name, SKU, brand and short description', () => {
    const filter = buildSearchFilter(['abc', 'powder']) as { $and: { $or: Record<string, RegExp>[] }[] };
    expect(filter.$and).toHaveLength(2);
    for (const clause of filter.$and) {
      expect(clause.$or.map((c) => Object.keys(c)[0])).toEqual(['name', 'sku', 'brand', 'shortDescription']);
    }
  });
  it('matches partial words in any case', () => {
    const [{ $or }] = (buildSearchFilter(['extin']) as { $and: { $or: Record<string, RegExp>[] }[] }).$and;
    expect($or[0].name.test('ABC Fire EXTINGUISHER 4kg')).toBe(true);
    expect($or[0].name.test('Smoke detector')).toBe(false);
  });
  it('treats regex characters as plain text (no injection, no crash)', () => {
    for (const nasty of ['(', '[a-z', '.*', 'a+', '(a+)+$', '\\']) {
      const [{ $or }] = (buildSearchFilter([nasty]) as { $and: { $or: Record<string, RegExp>[] }[] }).$and;
      expect(() => $or[0].name.test('anything')).not.toThrow();
    }
    const [{ $or }] = (buildSearchFilter(['.*']) as { $and: { $or: Record<string, RegExp>[] }[] }).$and;
    expect($or[0].name.test('plain product')).toBe(false); // ".*" is NOT a wildcard
    expect($or[0].name.test('Model .* special')).toBe(true);
  });
});
