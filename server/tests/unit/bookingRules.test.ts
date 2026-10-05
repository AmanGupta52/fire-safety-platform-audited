import { describe, it, expect } from 'vitest';
import {
  canTransition, STATUS_TRANSITIONS, historyTypeFor, dueDateUpdateFor, isValidSlot, dayRangeUtc,
  isHttpUrl, cleanUrlList, isSignatureDataUrl, assertNotInPast, parseBookingDate, TECHNICIAN_SETTABLE
} from '../../src/services/bookingRules';

describe('booking status flow', () => {
  it('allows the normal forward path', () => {
    expect(canTransition('requested', 'confirmed')).toBe(true);
    expect(canTransition('requested', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'technician_on_the_way')).toBe(true);
    expect(canTransition('technician_on_the_way', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
  });
  it('blocks skipping straight to completed', () => {
    expect(canTransition('requested', 'completed')).toBe(false);
    expect(canTransition('assigned', 'completed')).toBe(false);
    expect(canTransition('confirmed', 'completed')).toBe(false);
  });
  it('treats completed, cancelled and rejected as final', () => {
    for (const final of ['completed', 'cancelled', 'rejected'] as const) {
      expect(STATUS_TRANSITIONS[final]).toEqual([]);
      expect(canTransition(final, 'in_progress')).toBe(false);
    }
  });
  it('lets a no-op "same status" through', () => {
    expect(canTransition('assigned', 'assigned')).toBe(true);
  });
  it('technicians may only set on-the-way / in-progress', () => {
    expect(TECHNICIAN_SETTABLE).toEqual(['technician_on_the_way', 'in_progress']);
  });
});

describe('historyTypeFor: catalog slugs are hyphenated and dynamic', () => {
  it('maps real catalog slugs correctly (the old underscore check missed these)', () => {
    expect(historyTypeFor('fire-safety-audit')).toBe('inspection');
    expect(historyTypeFor('amc')).toBe('inspection');
    expect(historyTypeFor('fire-extinguisher-refilling')).toBe('refilling');
    expect(historyTypeFor('installation')).toBe('installation');
    expect(historyTypeFor('sprinkler-system-installation')).toBe('installation');
    expect(historyTypeFor('hose-repair')).toBe('repair');
  });
  it('also understands legacy underscore values', () => {
    expect(historyTypeFor('fire_safety_audit')).toBe('inspection');
    expect(historyTypeFor('refilling')).toBe('refilling');
  });
  it('falls back to maintenance for services an admin invented', () => {
    expect(historyTypeFor('hydrant-flow-testing')).toBe('maintenance');
    expect(historyTypeFor('')).toBe('maintenance');
  });
  it('always returns a value the equipment history enum accepts', () => {
    const allowed = ['installation', 'inspection', 'refilling', 'repair', 'maintenance'];
    for (const slug of ['amc', 'x', 'fire-safety-audit', 'refill', 'Install Pro', 'REPAIR']) {
      expect(allowed).toContain(historyTypeFor(slug));
    }
  });
  it('moves the right due dates', () => {
    expect(dueDateUpdateFor('refilling')).toEqual({ inspection: false, refill: true });
    expect(dueDateUpdateFor('inspection')).toEqual({ inspection: true, refill: false });
    expect(dueDateUpdateFor('repair')).toEqual({ inspection: false, refill: false });
  });
});

describe('input checks', () => {
  it('accepts only the four standard time slots', () => {
    expect(isValidSlot('09:00 - 11:00')).toBe(true);
    expect(isValidSlot('03:00 - 04:00')).toBe(false);
    expect(isValidSlot(undefined)).toBe(false);
  });
  it('isHttpUrl / cleanUrlList reject javascript: and junk', () => {
    expect(isHttpUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(cleanUrlList(['https://a.com/1.jpg', 'javascript:x', 5, null])).toEqual(['https://a.com/1.jpg']);
    expect(cleanUrlList('nope')).toEqual([]);
  });
  it('limits photo lists', () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://a.com/${i}.jpg`);
    expect(cleanUrlList(many, 10)).toHaveLength(10);
  });
  it('signature must be a small PNG/JPEG data URL', () => {
    expect(isSignatureDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSignatureDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSignatureDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isSignatureDataUrl('data:image/png;base64,' + 'A'.repeat(400_000))).toBe(false);
  });
});

describe('dates', () => {
  it('dayRangeUtc covers exactly one UTC day', () => {
    const { start, end } = dayRangeUtc(new Date('2026-03-05T17:45:00Z'));
    expect(start.toISOString()).toBe('2026-03-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-05T23:59:59.999Z');
  });
  it('rejects past days, accepts today and the future', () => {
    expect(() => assertNotInPast(new Date(Date.now() - 3 * 86400000))).toThrow();
    expect(() => assertNotInPast(new Date())).not.toThrow();
    expect(() => assertNotInPast(new Date(Date.now() + 3 * 86400000))).not.toThrow();
  });
  it('rejects unparseable dates', () => {
    expect(() => parseBookingDate('not-a-date')).toThrow();
  });
});
