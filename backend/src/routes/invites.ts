import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as inviteModel from '../models/workspace-invite.model';
import * as workspaceModel from '../models/workspace.model';
import * as userModel from '../models/user';
import type { InviteInfo } from '../../../src/shared/types';

const router = Router();

// GET /invites/:token — public: info for the accept page (no auth required).
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const invite = await inviteModel.findByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ success: false, data: null, error: 'Invitation not found' });
      return;
    }
    const info: InviteInfo = {
      workspaceName: invite.workspaceName,
      email: invite.email,
      role: invite.role,
      valid: invite.status === 'pending' && !invite.expired,
    };
    res.status(200).json({ success: true, data: info, error: null });
  } catch (err) {
    console.error('Get invite error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to load invitation' });
  }
});

// POST /invites/:token/accept — authenticated; the logged-in user's email must
// match the invite. Adds them to the workspace and marks the invite accepted.
router.post('/:token/accept', authenticate, async (req: Request, res: Response) => {
  try {
    const invite = await inviteModel.findByToken(req.params.token);
    if (!invite) {
      res.status(404).json({ success: false, data: null, error: 'Invitation not found' });
      return;
    }
    if (invite.status !== 'pending') {
      res.status(409).json({ success: false, data: null, error: 'This invitation has already been used or revoked' });
      return;
    }
    if (invite.expired) {
      res.status(410).json({ success: false, data: null, error: 'This invitation has expired' });
      return;
    }

    const user = await userModel.findById(req.user!.id);
    if (!user) {
      res.status(401).json({ success: false, data: null, error: 'Not authenticated' });
      return;
    }
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      res.status(403).json({
        success: false, data: null,
        error: `This invitation is for ${invite.email}. Sign in with that email to accept.`,
      });
      return;
    }

    const role = invite.role === 'owner' ? 'admin' : invite.role; // never grant owner via invite
    await workspaceModel.addMemberByEmail(invite.workspaceId, user.email, role);
    await inviteModel.markAccepted(invite.id);

    res.status(200).json({ success: true, data: { workspaceId: invite.workspaceId }, error: null });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to accept invitation' });
  }
});

export default router;
