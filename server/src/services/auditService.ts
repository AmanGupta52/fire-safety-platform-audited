import { Request } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { clientIp, clientUserAgent } from '../utils/clientIp';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordResetTokenHash',
  'emailOtpHash',
  '__v',
  'salt'
]);
// Anything that looks like a credential is redacted, even if it is not in the list above.
const SENSITIVE_PATTERN = /password|token|secret|otp(hash)?$|apikey|authorization/i;
const HASH_VERSION = 2;

function sanitizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString();
  if (val instanceof Types.ObjectId) return val.toString();

  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k) || SENSITIVE_PATTERN.test(k)) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = sanitizeValue(v);
    }
  }
  return sanitized;
}

export function calculateDiff(
  prev: unknown,
  curr: unknown
): Record<string, { before: unknown; after: unknown }> | null {
  const cleanPrev = sanitizeValue(prev) as Record<string, unknown> | null;
  const cleanCurr = sanitizeValue(curr) as Record<string, unknown> | null;

  if (!cleanPrev && !cleanCurr) return null;

  const diff: Record<string, { before: unknown; after: unknown }> = {};

  if (!cleanPrev && cleanCurr && typeof cleanCurr === 'object') {
    for (const [key, val] of Object.entries(cleanCurr)) {
      diff[key] = { before: null, after: val };
    }
    return diff;
  }

  if (cleanPrev && !cleanCurr && typeof cleanPrev === 'object') {
    for (const [key, val] of Object.entries(cleanPrev)) {
      diff[key] = { before: val, after: null };
    }
    return diff;
  }

  if (typeof cleanPrev === 'object' && typeof cleanCurr === 'object' && cleanPrev && cleanCurr) {
    const allKeys = new Set([...Object.keys(cleanPrev), ...Object.keys(cleanCurr)]);
    for (const key of allKeys) {
      const v1 = cleanPrev[key];
      const v2 = cleanCurr[key];
      if (JSON.stringify(v1) !== JSON.stringify(v2)) {
        diff[key] = { before: v1 ?? null, after: v2 ?? null };
      }
    }
    return Object.keys(diff).length > 0 ? diff : null;
  }

  if (cleanPrev !== cleanCurr) {
    return { value: { before: cleanPrev, after: cleanCurr } };
  }

  return null;
}

/** JSON with keys sorted at every level, so the same data always produces the same string. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export interface SealInput {
  seq: number;
  prevHash: string;
  actorId: string;
  actorEmail: string;
  action: string;
  module: string;
  entity: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  diff: unknown;
  ipAddress: string;
  userAgent: string;
  isoTimestamp: string;
}

let warnedAboutSecret = false;
function auditKey(): string {
  if (env.auditHmacSecret) return env.auditHmacSecret;
  if (env.nodeEnv === 'production' && !warnedAboutSecret) {
    warnedAboutSecret = true;
    logger.warn('AUDIT_HMAC_SECRET is not set; falling back to JWT_SECRET for the audit chain. Set a dedicated secret.');
  }
  return env.jwtSecret;
}

/**
 * Keyed (HMAC-SHA256) seal over EVERY stored field, including previousValue/newValue. Because it is keyed,
 * someone who can only write to the database cannot recompute a valid chain after editing entries.
 */
export function computeLogHash(input: SealInput, key: string = auditKey()): string {
  const payload = canonicalJson({
    v: HASH_VERSION,
    seq: input.seq,
    prevHash: input.prevHash,
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    action: input.action,
    module: input.module,
    entity: input.entity,
    entityId: input.entityId,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    diff: input.diff ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    ts: input.isoTimestamp
  });
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

export interface AuditActor {
  type: 'user' | 'system';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
}

// Writes are serialised inside this process so two simultaneous requests never read the same chain head.
// Across processes the unique index on prevHash is the backstop (duplicate key -> re-read head -> retry).
let writeQueue: Promise<unknown> = Promise.resolve();

async function appendSealed(actor: AuditActor, entry: {
  action: string; module: string; entity?: string; entityId?: Types.ObjectId | string;
  previousValue: unknown; newValue: unknown;
}) {
  const previousValue = sanitizeValue(entry.previousValue);
  const newValue = sanitizeValue(entry.newValue);
  const diff = calculateDiff(entry.previousValue, entry.newValue);

  for (let attempt = 0; attempt < 6; attempt++) {
    // The head is the entry with the highest sequence number (not the newest timestamp), so server clocks that
    // disagree can never make two instances pick different heads.
    const head = await AuditLog.findOne({ hashVersion: HASH_VERSION }).sort({ seq: -1 }).select('hash seq').lean();
    const seq = (head?.seq ?? 0) + 1;
    // The first sealed entry links to the newest legacy hash (or genesis) so old history stays linked in.
    let prevHash = head?.hash;
    if (!prevHash) {
      const legacyHead = await AuditLog.findOne({ hashVersion: { $ne: HASH_VERSION } }).sort({ createdAt: -1, _id: -1 }).select('hash').lean();
      prevHash = legacyHead?.hash || GENESIS_HASH;
    }

    const now = new Date();
    const hash = computeLogHash({
      seq,
      prevHash,
      actorId: actor.userId || '',
      actorEmail: actor.email || '',
      action: entry.action,
      module: entry.module,
      entity: entry.entity || '',
      entityId: String(entry.entityId ?? ''),
      previousValue,
      newValue,
      diff,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      isoTimestamp: now.toISOString()
    });

    try {
      await AuditLog.create({
        user: actor.userId,
        actorType: actor.type,
        actorEmail: actor.email,
        action: entry.action,
        module: entry.module,
        entity: entry.entity,
        entityId: entry.entityId,
        previousValue,
        newValue,
        diff,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        hashVersion: HASH_VERSION,
        seq,
        prevHash,
        hash,
        createdAt: now
      });
      return;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 11000 && attempt < 5) continue; // lost a race for this chain position
      throw err;
    }
  }
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(job, job);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Records an action by the signed-in user. Failures are logged, never thrown into the request. */
export async function writeAuditLog(
  req: Request,
  action: string,
  module: string,
  entity: string,
  entityId: Types.ObjectId | string,
  previousValue: unknown,
  newValue: unknown
) {
  if (!req.user) return; // use writeSystemAuditLog for unauthenticated events
  try {
    await enqueue(() =>
      appendSealed(
        { type: 'user', userId: req.user!.id, ipAddress: clientIp(req), userAgent: clientUserAgent(req) },
        { action, module, entity, entityId, previousValue, newValue }
      )
    );
  } catch (err) {
    logger.error({ err, action, module }, '[audit] Failed to write audit log');
  }
}

/**
 * Records security events that have no signed-in user: failed logins, lockouts, password resets.
 * `userId`/`email` identify the affected account when it exists.
 */
export async function writeSystemAuditLog(
  req: Pick<Request, 'ip' | 'socket' | 'headers'>,
  action: string,
  module: string,
  details: { userId?: string; email?: string; entity?: string; entityId?: Types.ObjectId | string; data?: unknown }
) {
  try {
    await enqueue(() =>
      appendSealed(
        {
          type: 'system',
          userId: details.userId,
          email: details.email || 'unknown',
          ipAddress: clientIp(req),
          userAgent: clientUserAgent(req)
        },
        {
          action,
          module,
          entity: details.entity || 'User',
          entityId: details.entityId ?? details.userId,
          previousValue: null,
          newValue: details.data ?? null
        }
      )
    );
  } catch (err) {
    logger.error({ err, action, module }, '[audit] Failed to write system audit log');
  }
}

export interface ChainVerification {
  isValid: boolean;
  totalLogs: number;
  sealedLogs: number;
  legacyLogs: number;
  invalidEntryId?: string;
  reason?: string;
}

/**
 * Verifies the sealed chain from start to finish:
 *   1. every entry's HMAC matches its content (detects edits),
 *   2. sequence numbers run 1, 2, 3 ... without gaps (detects deleted entries),
 *   3. every entry's prevHash equals the hash of the entry before it (detects reordering and splicing).
 * Unsealed legacy entries from before the chain existed are counted, not failed.
 * Limit: removing the very newest entries leaves a shorter but still valid chain. To detect that, periodically
 * copy the latest hash to somewhere an attacker with database access cannot reach.
 */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const key = auditKey();
  const legacyHashes = new Set<string>();
  let legacy = 0;
  let sealed = 0;
  let expectedSeq = 1;
  let previous: { hash: string } | null = null;

  const fail = (id: unknown, reason: string): ChainVerification => ({
    isValid: false, totalLogs: sealed + legacy, sealedLogs: sealed, legacyLogs: legacy, invalidEntryId: String(id), reason
  });

  const cursor = AuditLog.find().sort({ hashVersion: 1, seq: 1, createdAt: 1, _id: 1 }).lean().cursor();
  for await (const log of cursor) {
    if (log.hashVersion !== HASH_VERSION) {
      legacy++;
      if (log.hash) legacyHashes.add(log.hash);
      continue;
    }
    sealed++;

    if (log.seq !== expectedSeq) {
      return fail(log._id, `Expected entry number ${expectedSeq} but found ${log.seq ?? 'none'}. A record was removed or reordered.`);
    }

    const expected = computeLogHash(
      {
        seq: log.seq,
        prevHash: log.prevHash,
        actorId: log.user ? String(log.user) : '',
        actorEmail: log.actorEmail || '',
        action: log.action,
        module: log.module,
        entity: log.entity || '',
        entityId: String(log.entityId ?? ''),
        previousValue: log.previousValue,
        newValue: log.newValue,
        diff: log.diff,
        ipAddress: log.ipAddress || '',
        userAgent: log.userAgent || '',
        isoTimestamp: new Date(log.createdAt).toISOString()
      },
      key
    );
    if (expected !== log.hash) {
      return fail(log._id, `Entry ${log.seq} does not match its seal. Its content was changed after it was written.`);
    }

    if (previous) {
      if (log.prevHash !== previous.hash) return fail(log._id, `Entry ${log.seq} is not linked to the entry before it.`);
    } else if (log.prevHash !== GENESIS_HASH && !legacyHashes.has(log.prevHash)) {
      return fail(log._id, 'The first sealed entry is not linked to the start of the chain or to any earlier entry.');
    }

    previous = { hash: log.hash };
    expectedSeq++;
  }

  return { isValid: true, totalLogs: sealed + legacy, sealedLogs: sealed, legacyLogs: legacy };
}
