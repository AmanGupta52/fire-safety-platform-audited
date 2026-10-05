import { Request } from 'express';

/**
 * The client's IP address. Express resolves this through the `trust proxy` setting (see app.ts), so it only
 * honours X-Forwarded-For from the configured number of trusted proxies. Never read the header directly:
 * clients can send any value and would otherwise forge the IP recorded in audit logs and security alerts.
 */
export function clientIp(req: Pick<Request, 'ip' | 'socket'>): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function clientUserAgent(req: Pick<Request, 'headers'>): string {
  const ua = req.headers['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua || 'unknown').slice(0, 300);
}
