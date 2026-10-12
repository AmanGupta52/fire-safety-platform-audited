/**
 * Day and month boundaries in India Standard Time (Asia/Kolkata = UTC+5:30, no daylight saving),
 * returned as ordinary UTC `Date`s ready to use in Mongo filters.
 *
 * The server runs in UTC (Render), so `setHours(0,0,0,0)` would start "today" at 05:30 IST and, between
 * 00:00 and 05:30 IST, still report yesterday. Plain offset arithmetic avoids both problems and needs no
 * date library.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const IST_TIMEZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant that is 00:00 IST on the IST calendar day containing `now`. */
export function istStartOfDay(now: Date = new Date()): Date {
  // Shift so the UTC fields read like the IST wall clock, cut to midnight, shift back.
  const wallClock = new Date(now.getTime() + IST_OFFSET_MS);
  wallClock.setUTCHours(0, 0, 0, 0);
  return new Date(wallClock.getTime() - IST_OFFSET_MS);
}

/** The instant that is 00:00 IST on the first day of the IST month containing `now`. */
export function istStartOfMonth(now: Date = new Date()): Date {
  const wallClock = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(wallClock.getUTCFullYear(), wallClock.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** Half-open window [start, end) covering the whole IST day that contains `now`. */
export function istDayWindow(now: Date = new Date()): { start: Date; end: Date } {
  const start = istStartOfDay(now);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
