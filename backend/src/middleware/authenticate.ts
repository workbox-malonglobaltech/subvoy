import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { getTokenVersion, findById } from '../models/user';
import { isSupabaseAuthEnabled, verifySupabaseToken, resolveDomainUser } from '../lib/supabase-auth';
import { UserRole, WorkspaceType, WorkspaceRole } from '../../../src/shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
      /** Active workspace for this request (set by workspaceContext middleware). */
      workspace?: { id: string; type: WorkspaceType; role: WorkspaceRole };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  // ── Supabase Auth (single IdP for web + iOS + Android) ──────────────────────
  // When configured, a Bearer access token takes precedence. The legacy cookie
  // path below stays intact so both work during migration.
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (bearer && isSupabaseAuthEnabled()) {
    try {
      const identity = await verifySupabaseToken(bearer);
      const user = await resolveDomainUser(identity);
      if (user.suspendedAt) {
        res.status(403).json({ success: false, data: null, error: 'Your account has been suspended. Please contact support.' });
        return;
      }
      req.user = { id: user.id, role: user.role };
      next();
      return;
    } catch {
      res.status(401).json({ success: false, data: null, error: 'Invalid or expired token' });
      return;
    }
  }

  // ── Legacy cookie session (current web) ─────────────────────────────────────
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
