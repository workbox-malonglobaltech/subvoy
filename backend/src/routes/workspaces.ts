import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { allowsTeams } from '../lib/capabilities';
import * as workspaceModel from '../models/workspace.model';
import * as inviteModel from '../models/workspace-invite.model';
import { sendWorkspaceInviteEmail } from '../services/email.service';
import { isWithinLimit, getEffectiveLimit, UNLIMITED } from '../services/entitlements.service';

/** Seats used = current members + pending invites. */
async function seatsUsed(workspaceId: string): Promise<number> {
  const [members, invites] = await Promise.all([
    workspaceModel.countMembers(workspaceId),
    inviteModel.listPending(workspaceId),
  ]);
  return members + invites.length;
}

function seatLimitError(limit: number): string {
  return `You've reached your plan limit of ${limit === UNLIMITED ? 'unlimited' : limit} members. Upgrade to add more.`;
}

const router = Router();

// Authenticated, but NOT workspace-scoped — this endpoint lists/creates the
// workspaces themselves, so it must not require an active-workspace context.
router.use(authenticate);

// GET /workspaces — every workspace the user belongs to, with their role.
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaces = await workspaceModel.listForUser(req.user!.id);
    res.status(200).json({ success: true, data: workspaces, error: null });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch workspaces' });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  /** ISO 3166-1 alpha-2 country, optional */
  country: z.string().length(2).optional(),
});

// POST /workspaces — create a Business workspace (caller becomes owner).
router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const { name, country } = req.body as z.infer<typeof createSchema>;
    const workspace = await workspaceModel.createBusinessWorkspace(req.user!.id, name, country);
    res.status(201).json({ success: true, data: workspace, error: null });
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create workspace' });
  }
});

// ── Team management ─────────────────────────────────────────────────────────────

const roleSchema = z.object({ role: z.enum(['admin', 'member']) });
const addMemberSchema = roleSchema.extend({ email: z.string().email() });

/** Loads the workspace + the caller's role; null role = not a member. */
async function loadContext(workspaceId: string, userId: string) {
  const [workspace, role] = await Promise.all([
    workspaceModel.findById(workspaceId),
    workspaceModel.getMemberRole(workspaceId, userId),
  ]);
  return { workspace, role };
}

// GET /workspaces/:id/members — any member may view.
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const role = await workspaceModel.getMemberRole(req.params.id, req.user!.id);
    if (!role) {
      res.status(403).json({ success: false, data: null, error: 'Not a member of this workspace' });
      return;
    }
    const members = await workspaceModel.listMembers(req.params.id);
    res.status(200).json({ success: true, data: members, error: null });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch members' });
  }
});

// POST /workspaces/:id/members — add by email (owner/admin, business only).
router.post('/:id/members', validate(addMemberSchema), async (req: Request, res: Response) => {
  try {
    const { workspace, role } = await loadContext(req.params.id, req.user!.id);
    if (!workspace) {
      res.status(404).json({ success: false, data: null, error: 'Workspace not found' });
      return;
    }
    if (!allowsTeams(workspace.type)) {
      res.status(400).json({ success: false, data: null, error: 'This workspace does not support teams' });
      return;
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can add members' });
      return;
    }
    const { email, role: newRole } = req.body as z.infer<typeof addMemberSchema>;
    const member = await workspaceModel.addMemberByEmail(req.params.id, email, newRole);
    if (!member) {
      res.status(404).json({ success: false, data: null, error: 'No Subvoy account found for that email' });
      return;
    }
    res.status(201).json({ success: true, data: member, error: null });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to add member' });
  }
});

// PUT /workspaces/:id/members/:userId — change role (owner/admin; owner protected).
router.put('/:id/members/:userId', validate(roleSchema), async (req: Request, res: Response) => {
  try {
    const { workspace, role } = await loadContext(req.params.id, req.user!.id);
    if (!workspace) {
      res.status(404).json({ success: false, data: null, error: 'Workspace not found' });
      return;
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can change roles' });
      return;
    }
    const targetRole = await workspaceModel.getMemberRole(req.params.id, req.params.userId);
    if (targetRole === 'owner') {
      res.status(403).json({ success: false, data: null, error: "The owner's role cannot be changed" });
      return;
    }
    const member = await workspaceModel.updateMemberRole(req.params.id, req.params.userId, req.body.role);
    if (!member) {
      res.status(404).json({ success: false, data: null, error: 'Member not found' });
      return;
    }
    res.status(200).json({ success: true, data: member, error: null });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update member' });
  }
});

// DELETE /workspaces/:id/members/:userId — remove (owner/admin; owner protected).
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const { workspace, role } = await loadContext(req.params.id, req.user!.id);
    if (!workspace) {
      res.status(404).json({ success: false, data: null, error: 'Workspace not found' });
      return;
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can remove members' });
      return;
    }
    const targetRole = await workspaceModel.getMemberRole(req.params.id, req.params.userId);
    if (targetRole === 'owner') {
      res.status(403).json({ success: false, data: null, error: 'The owner cannot be removed' });
      return;
    }
    const removed = await workspaceModel.removeMember(req.params.id, req.params.userId);
    if (!removed) {
      res.status(404).json({ success: false, data: null, error: 'Member not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to remove member' });
  }
});

// ── Invitations (owner/admin, business only) ────────────────────────────────────

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(['admin', 'member']) });

// GET /workspaces/:id/invites — pending invitations (owner/admin)
router.get('/:id/invites', async (req: Request, res: Response) => {
  try {
    const role = await workspaceModel.getMemberRole(req.params.id, req.user!.id);
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can view invitations' });
      return;
    }
    const invites = await inviteModel.listPending(req.params.id);
    res.status(200).json({ success: true, data: invites, error: null });
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch invitations' });
  }
});

// POST /workspaces/:id/invites — invite by email (owner/admin, business only)
router.post('/:id/invites', validate(inviteSchema), async (req: Request, res: Response) => {
  try {
    const { workspace, role } = await loadContext(req.params.id, req.user!.id);
    if (!workspace) {
      res.status(404).json({ success: false, data: null, error: 'Workspace not found' });
      return;
    }
    if (!allowsTeams(workspace.type)) {
      res.status(400).json({ success: false, data: null, error: 'This workspace does not support teams' });
      return;
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can invite' });
      return;
    }

    // Plan cap on team size (members + pending invites), admin-tunable.
    if (!(await isWithinLimit(req.params.id, 'max_members', await seatsUsed(req.params.id)))) {
      const limit = await getEffectiveLimit(req.params.id, 'max_members');
      res.status(402).json({ success: false, data: null, error: seatLimitError(limit) });
      return;
    }

    const { email, role: newRole } = req.body as z.infer<typeof inviteSchema>;

    const { invite, token } = await inviteModel.createInvite(req.params.id, email, newRole, req.user!.id);

    const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    sendWorkspaceInviteEmail({
      toEmail: email,
      workspaceName: workspace.name,
      role: newRole,
      acceptUrl: `${base}/invite/${token}`,
    }).catch(err => console.error('[invite] email failed:', err));

    res.status(201).json({ success: true, data: invite, error: null });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to send invitation' });
  }
});

// DELETE /workspaces/:id/invites/:inviteId — revoke a pending invite (owner/admin)
router.delete('/:id/invites/:inviteId', async (req: Request, res: Response) => {
  try {
    const role = await workspaceModel.getMemberRole(req.params.id, req.user!.id);
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ success: false, data: null, error: 'Only owners and admins can revoke invitations' });
      return;
    }
    const revoked = await inviteModel.revoke(req.params.inviteId, req.params.id);
    if (!revoked) {
      res.status(404).json({ success: false, data: null, error: 'Invitation not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Revoke invite error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to revoke invitation' });
  }
});

export default router;
