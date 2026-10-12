import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { User, effectivePermissionsFor } from '../models/User';
import { Permission } from '../config/permissions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        permissions: Permission[];
      };
    }
  }
}

// The only user fields authentication and permission checks use.
const AUTH_FIELDS = 'role isActive permissionOverrides passwordChangedAt';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Authentication token missing'));
  }

  const token = header.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    // Read on every authenticated request, so fetch only what the checks below need, as a plain object. There is
    // deliberately NO cache: a disabled user, a role change or a password change takes effect on the very next request.
    const user = await User.findById(payload.userId).select(AUTH_FIELDS).lean();
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('Account not found or disabled'));
    }
    // A password change/reset invalidates access tokens issued before it (compare in whole seconds, as iat is).
    if (user.passwordChangedAt && payload.iat && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return next(ApiError.unauthorized('Session expired after a password change. Please sign in again.'));
    }
    req.user = {
      id: user._id.toString(),
      role: user.role,
      permissions: effectivePermissionsFor(user.role, user.permissionOverrides)
    };
    next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

// Optional auth: attaches req.user if a valid token is present, but never blocks the request.
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const payload = verifyAccessToken(header.split(' ')[1]);
    const user = await User.findById(payload.userId).select(AUTH_FIELDS).lean();
    const stale = !!(user?.passwordChangedAt && payload.iat && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000));
    if (user && user.isActive && !stale) {
      req.user = { id: user._id.toString(), role: user.role, permissions: effectivePermissionsFor(user.role, user.permissionOverrides) };
    }
  } catch {
    // ignore invalid token in optional-auth contexts
  }
  next();
}
