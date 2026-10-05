import { describe, it, expect } from 'vitest';
import { canonicalJson, computeLogHash, SealInput } from '../../src/services/auditService';

const base: SealInput = {
  seq: 7,
  prevHash: '0'.repeat(64),
  actorId: 'u1',
  actorEmail: 'a@example.com',
  action: 'update',
  module: 'settings',
  entity: 'Setting',
  entityId: 'company',
  previousValue: { name: 'Old' },
  newValue: { name: 'New' },
  diff: { name: { before: 'Old', after: 'New' } },
  ipAddress: '203.0.113.5',
  userAgent: 'jest',
  isoTimestamp: '2026-01-01T00:00:00.000Z'
};
const KEY = 'unit-test-key';

describe('canonicalJson', () => {
  it('is independent of key order, at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
  it('ignores undefined fields and treats undefined/null alike at the top level', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson(undefined)).toBe('null');
  });
  it('distinguishes values that merely look alike', () => {
    expect(canonicalJson({ a: '1' })).not.toBe(canonicalJson({ a: 1 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('computeLogHash (HMAC seal)', () => {
  it('is deterministic', () => {
    expect(computeLogHash(base, KEY)).toBe(computeLogHash({ ...base }, KEY));
  });
  it('changes when ANY sealed field changes, including previousValue/newValue/diff', () => {
    const original = computeLogHash(base, KEY);
    const tampered: Partial<SealInput>[] = [
      { seq: 8 },
      { prevHash: '1'.repeat(64) },
      { actorId: 'u2' },
      { actorEmail: 'b@example.com' },
      { action: 'delete' },
      { module: 'users' },
      { entity: 'User' },
      { entityId: 'other' },
      { previousValue: { name: 'Different' } },
      { newValue: { name: 'Different' } },
      { diff: { name: { before: 'x', after: 'y' } } },
      { ipAddress: '198.51.100.1' },
      { userAgent: 'curl' },
      { isoTimestamp: '2026-01-02T00:00:00.000Z' }
    ];
    for (const change of tampered) {
      expect(computeLogHash({ ...base, ...change }, KEY)).not.toBe(original);
    }
  });
  it('cannot be recomputed without the secret key', () => {
    expect(computeLogHash(base, 'attacker-guess')).not.toBe(computeLogHash(base, KEY));
  });
  it('is not affected by object key order inside previousValue/newValue', () => {
    const a = computeLogHash({ ...base, newValue: { x: 1, y: 2 } }, KEY);
    const b = computeLogHash({ ...base, newValue: { y: 2, x: 1 } }, KEY);
    expect(a).toBe(b);
  });
});
