import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { Permission } from '../config/permissions';

/**
 * Enforces granular, backend-verified permission checks.
 * Usage: router.post('/products', requireAuth, requirePermission('products.create'), controller)
 * Never rely on the frontend to hide a button — this middleware is the real gate.
 */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());

    if (req.user.role === 'super_admin') return next();

    const has = required.every((perm) => req.user!.permissions.includes(perm));
    if (!has) {
      return next(ApiError.forbidden(`Missing required permission: ${required.join(', ')}`));
    }
    next();
  };
}

// Like requirePermission, but passes if the user has ANY one of the listed permissions —
// useful for shared endpoints (e.g. image upload) used by several resource types.
export function requireAnyPermission(...anyOf: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'super_admin') return next();

    const has = anyOf.some((perm) => req.user!.permissions.includes(perm));
    if (!has) {
      return next(ApiError.forbidden(`Missing required permission: one of ${anyOf.join(', ')}`));
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have access to this resource'));
    }
    next();
  };
}

// Convenience: only the resource owner (matching :userId-ish logic in controller) or staff with the permission.
export function requireSelfOrPermission(getOwnerId: (req: Request) => string, ...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'super_admin') return next();
    if (getOwnerId(req) === req.user.id) return next();
    const has = perms.every((p) => req.user!.permissions.includes(p));
    if (!has) return next(ApiError.forbidden());
    next();
  };
}
