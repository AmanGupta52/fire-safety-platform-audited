import { describe, it, expect } from 'vitest';
import { parseDurationMs } from '../../src/utils/duration';
import { detectFileType } from '../../src/utils/fileSignature';
import { escapeRegex } from '../../src/utils/escapeRegex';
import { clientIp } from '../../src/utils/clientIp';
import { escapeHtml, safeUrl, emailTemplates } from '../../src/services/emailService';
import { hashToken } from '../../src/utils/jwt';

describe('parseDurationMs', () => {
  it('understands the units used in .env files', () => {
    expect(parseDurationMs('15m', 0)).toBe(15 * 60 * 1000);
    expect(parseDurationMs('7d', 0)).toBe(7 * 86400000);
    expect(parseDurationMs('30d', 0)).toBe(30 * 86400000);
    expect(parseDurationMs('12h', 0)).toBe(12 * 3600000);
    expect(parseDurationMs('2w', 0)).toBe(14 * 86400000);
  });
  it('treats a bare number as seconds (jsonwebtoken convention)', () => {
    expect(parseDurationMs('90', 0)).toBe(90_000);
    expect(parseDurationMs(60, 0)).toBe(60_000);
  });
  it('falls back for empty or invalid input instead of returning NaN/0', () => {
    expect(parseDurationMs(undefined, 123)).toBe(123);
    expect(parseDurationMs('', 123)).toBe(123);
    expect(parseDurationMs('soon', 123)).toBe(123);
    expect(parseDurationMs('0d', 123)).toBe(123);
  });
});

describe('detectFileType (magic bytes)', () => {
  const pad = (bytes: number[]) => Buffer.from([...bytes, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  it('recognises the five accepted formats by content', () => {
    expect(detectFileType(pad([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(detectFileType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(detectFileType(Buffer.from('GIF89a......'))?.ext).toBe('gif');
    expect(detectFileType(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 '))?.ext).toBe('webp');
    expect(detectFileType(Buffer.from('%PDF-1.7\n...'))?.ext).toBe('pdf');
  });
  it('rejects HTML, scripts and SVG whatever their file name says', () => {
    expect(detectFileType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectFileType(Buffer.from('#!/bin/sh\nrm -rf /'))).toBeNull();
  });
  it('rejects a PDF header that is not at byte 0 (HTML/PDF polyglots)', () => {
    expect(detectFileType(Buffer.from('<html>%PDF-1.7'))).toBeNull();
  });
  it('rejects empty and too-short buffers', () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('escapeRegex', () => {
  it('makes user input match literally and never throw', () => {
    for (const input of ['(', '[', 'a+b', '.*', '^$', '\\', 'a|b', '(?<x>', '{1,}']) {
      const re = new RegExp(escapeRegex(input), 'i');
      expect(re.test(input)).toBe(true);
    }
    expect(new RegExp(escapeRegex('.*')).test('anything')).toBe(false);
  });
});

describe('clientIp', () => {
  it('uses req.ip (resolved through trust proxy), never the raw X-Forwarded-For header', () => {
    const req = { ip: '203.0.113.9', socket: { remoteAddress: '10.0.0.1' }, headers: { 'x-forwarded-for': '1.2.3.4' } };
    expect(clientIp(req as never)).toBe('203.0.113.9');
  });
  it('falls back to the socket address', () => {
    expect(clientIp({ ip: undefined, socket: { remoteAddress: '10.0.0.1' } } as never)).toBe('10.0.0.1');
  });
});

describe('email template escaping', () => {
  it('escapes HTML in every user-controlled value', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    const html = emailTemplates.newDeviceLogin({
      name: '<b>Eve</b>', ipAddress: '1.1.1.1', time: 'now', userAgent: '"><script>alert(1)</script>'
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Eve</b>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('only allows http(s) links', () => {
    expect(safeUrl('https://example.com/a?b=1&c=2')).toContain('https://example.com');
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('data:text/html;base64,AAAA')).toBe('#');
  });
  it('escapes names in the staff invite', () => {
    const html = emailTemplates.staffInviteSetPassword({
      name: '<i>x</i>', role: 'admin', setPasswordLink: 'https://admin.example.com/reset?token=abc', expiresInHours: 24
    });
    expect(html).not.toContain('<i>x</i>');
  });
});

describe('hashToken', () => {
  it('is deterministic, hex, and never the token itself', () => {
    const h = hashToken('some.jwt.token');
    expect(h).toBe(hashToken('some.jwt.token'));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain('some');
  });
});
