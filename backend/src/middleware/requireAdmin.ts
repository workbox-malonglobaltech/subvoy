/**
 * requireAdmin middleware.
 *
 * Must be used AFTER authenticate. Checks that req.user.role is
 * 'staff' or 'superadmin'. Returns 403 otherwise.
 *
 * Usage:
 *   router.use(authenticate, requireAdmin);
 *
 * For superadmin-only actions pass requireRole('superadmin') instead.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../src/shared/types';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role;
  if (role !== 'staff' && role !== 'superadmin') {
    res.status(403).json({ success: false, data: null, error: 'Admin access required' });
    return;
  }
  next();
}

/** Returns a middleware that allows ONLY the given role(s). */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, data: null, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
