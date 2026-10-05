/**
 * Parses durations like "15m", "7d", "30d", "12h", "90s", "2w" into milliseconds.
 * A bare number is treated as SECONDS, which is the jsonwebtoken convention, so the value used to sign a
 * token and the value used for the matching database expiry can never disagree.
 */
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000
};

export function parseDurationMs(input: string | number | undefined, fallbackMs: number): number {
  if (input === undefined || input === null || input === '') return fallbackMs;
  if (typeof input === 'number') return input > 0 ? input * 1000 : fallbackMs;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i.exec(String(input).trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const ms = value * UNIT_MS[unit];
  return ms > 0 ? ms : fallbackMs;
}
