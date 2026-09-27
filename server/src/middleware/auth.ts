import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Authentication token missing'));
  }

  const token = header.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('Account not found or disabled'));
    }
    req.user = {
      id: user._id.toString(),
      role: user.role,
      permissions: user.effectivePermissions()
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
    const user = await User.findById(payload.userId);
    if (user && user.isActive) {
      req.user = { id: user._id.toString(), role: user.role, permissions: user.effectivePermissions() };
    }
  } catch {
    // ignore invalid token in optional-auth contexts
  }
  next();
}
