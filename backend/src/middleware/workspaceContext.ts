/**
 * Workspace context + guards.
 *
 * `workspaceContext` resolves the active workspace for a request and verifies the
 * caller is a member. The active workspace is chosen from the `X-Workspace-Id`
 * header; if absent, it defaults to the user's Personal workspace. The result is
 * the server-side source of truth for tenancy — never trust a client-supplied
 * workspace without the membership check here.
 *
 * `requireCapability(kind)` blocks obligation kinds the workspace type can't hold
 * (e.g. compliance in a personal workspace). `requireRole(...)` gates by member role.
 *
 * Must run AFTER `authenticate` (needs req.user).
 */

import { Request, Response, NextFunction } from 'express';
import * as workspaceModel from '../models/workspace.model';
import { canUseKind } from '../lib/capabilities';
import type { ObligationKind, WorkspaceRole } from '../../../src/shared/types';

export async function workspaceContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user!.id;
  const requested = req.header('X-Workspace-Id');

  try {
    if (requested) {
      const role = await workspaceModel.getMemberRole(requested, userId);
      if (!role) {
        res.status(403).json({ success: false, data: null, error: 'Not a member of this workspace' });
        return;
      }
      const ws = await workspaceModel.findById(requested);
      if (!ws) {
        res.status(404).json({ success: false, data: null, error: 'Workspace not found' });
        return;
      }
      req.workspace = { id: ws.id, type: ws.type, role };
    } else {
      // Default to the user's Personal workspace (idempotent — exists since signup).
      const ws = await workspaceModel.ensurePersonalWorkspace(userId);
      req.workspace = { id: ws.id, type: ws.type, role: 'owner' };
    }
    next();
  } catch (err) {
    console.error('workspaceContext error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to resolve workspace' });
  }
}

/** Rejects obligation kinds the active workspace type cannot hold. */
export function requireCapability(kind: ObligationKind) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.workspace) {
      res.status(500).json({ success: false, data: null, error: 'Workspace context missing' });
      return;
    }
    if (!canUseKind(req.workspace.type, kind)) {
      res.status(403).json({ success: false, data: null, error: `This workspace cannot use ${kind} features` });
      return;
    }
    next();
  };
}

/** Gates an action by the caller's role in the active workspace. */
export function requireRole(...roles: WorkspaceRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.workspace || !roles.includes(req.workspace.role)) {
      res.status(403).json({ success: false, data: null, error: 'Insufficient workspace role' });
      return;
    }
    next();
  };
}
