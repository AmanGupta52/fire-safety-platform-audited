import type { FilterQuery } from 'mongoose';
import { escapeRegex } from './escapeRegex';

/**
 * Product search used by the navbar, the quote form and the product list.
 *
 * Why not MongoDB's `$text`? It only matches WHOLE words, so "extin" finds nothing while the shopper is still typing,
 * and "abc" never matches "ABC Dry Powder 4kg". This builds a forgiving match instead: the query is split into words
 * and EVERY word must appear (as a prefix or a substring, any case) in the product name, SKU, brand or short text.
 *
 * Everything the visitor types is escaped, so characters like ( [ * + ? are plain text and can't be used to inject a
 * regex or cause catastrophic backtracking. The length and word-count limits keep a request cheap.
 */
export const MAX_QUERY_LENGTH = 100;
export const MAX_TOKENS = 5;
export const MAX_TOKEN_LENGTH = 40;

/** Fields a word can match in (the first two also get ranking bonuses). */
const SEARCH_FIELDS = ['name', 'sku', 'brand', 'shortDescription'] as const;

export interface ParsedQuery {
  /** The cleaned phrase (single spaces, trimmed, capped). */
  phrase: string;
  /** Individual words, lower-cased and capped. */
  tokens: string[];
}

export function parseSearchQuery(raw: unknown): ParsedQuery {
  // Express can hand us arrays/objects for ?q[]=a&q[$ne]=b: only a plain string counts.
  const text = typeof raw === 'string' ? raw : '';
  const phrase = text.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  const tokens = phrase
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
    .map((t) => t.slice(0, MAX_TOKEN_LENGTH));
  return { phrase, tokens };
}

/** Mongo filter: every word must match at least one searchable field. Empty for an empty query. */
export function buildSearchFilter(tokens: string[]): FilterQuery<unknown> {
  if (tokens.length === 0) return {};
  return {
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      return { $or: SEARCH_FIELDS.map((field) => ({ [field]: regex })) };
    })
  };
}

const rx = (input: string, pattern: string) => ({ $regexMatch: { input, regex: pattern, options: 'i' } });

/**
 * Aggregation expression that scores how good a match a product is (higher = better), so the best hits come first:
 * exact SKU > name starts with the phrase > SKU starts with it > a word starts a word in the name > name contains the
 * phrase > brand matches; products you can actually buy get a small bump.
 */
export function relevanceScore(phrase: string, tokens: string[]): Record<string, unknown> {
  const exact = escapeRegex(phrase);
  const first = escapeRegex(tokens[0] ?? '');
  return {
    $add: [
      { $cond: [{ $eq: [{ $toUpper: '$sku' }, phrase.toUpperCase()] }, 100, 0] },
      { $cond: [rx('$name', `^${exact}`), 60, 0] },
      { $cond: [rx('$sku', `^${exact}`), 40, 0] },
      { $cond: [rx('$name', `(^|[^a-z0-9])${first}`), 20, 0] },
      { $cond: [rx('$name', exact), 15, 0] },
      { $cond: [rx('$brand', exact), 10, 0] },
      { $cond: [{ $or: [{ $gt: ['$stock', 0] }, { $eq: ['$allowBackorder', true] }] }, 5, 0] }
    ]
  };
}
