import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { getTokenVersion, findById } from '../models/user';
import { UserRole } from '../../../src/shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ success: false, data: null, error: 'Authentication required' });
    return;
  }
  try {
    const { userId, tokenVersion } = verifyToken(token);

    // Verify token_version matches DB — if user logged out, their version is incremented
    const currentVersion = await getTokenVersion(userId);
    if (currentVersion === null || tokenVersion !== currentVersion) {
      res.status(401).json({ success: false, data: null, error: 'Session expired, please log in again' });
      return;
    }

    // Check suspension — suspended users are immediately blocked
    const user = await findById(userId);
    if (!user) {
      res.status(401).json({ success: false, data: null, error: 'Session expired, please log in again' });
      return;
    }
    if (user.suspendedAt) {
      res.status(403).json({ success: false, data: null, error: 'Your account has been suspended. Please contact support.' });
      return;
    }

    req.user = { id: userId, role: user.role };
    next();
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Invalid or expired token' });
  }
}
