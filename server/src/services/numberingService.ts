import { Setting } from '../models/AuditLog';

/**
 * Generates human-readable, sequential-looking business document numbers
 * (ORD-2026-000123, QT-2026-000045, ...) using a counter persisted in the Setting collection.
 * Prefixes are configurable via admin settings (see item 41 in the spec).
 */
export async function nextNumber(prefixKey: string, defaultPrefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterKey = `counter:${prefixKey}:${year}`;

  const prefixSetting = await Setting.findOne({ key: `prefix:${prefixKey}` });
  const prefix = (prefixSetting?.value as string) || defaultPrefix;

  // Atomic increment — two requests arriving at the same instant both get their own $inc
  // applied by MongoDB itself, so neither can read-then-write the same value as the other.
  // (The previous read-then-$set approach could hand out the same number to two concurrent
  // checkouts/quotes/bookings.)
  const updated = await Setting.findOneAndUpdate(
    { key: counterKey },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );

  const sequence = String(updated?.value ?? 1).padStart(6, '0');
  return `${prefix}-${year}-${sequence}`;
}
