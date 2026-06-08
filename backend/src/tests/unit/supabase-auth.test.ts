/**
 * Unit tests for Supabase Auth integration (Phase A): token verification +
 * domain-user resolution (find-by-auth / link-by-email / create).
 */
process.env.SUPABASE_JWT_SECRET = 'test-supabase-secret';

jest.mock('../../models/user', () => ({
  findByAuthId: jest.fn(),
  findByEmail: jest.fn(),
  linkAuthUserId: jest.fn(),
  createFromAuth: jest.fn(),
}));
jest.mock('../../models/workspace.model', () => ({ ensurePersonalWorkspace: jest.fn() }));

import jwt from 'jsonwebtoken';
import { verifySupabaseToken, resolveDomainUser, isSupabaseAuthEnabled } from '../../lib/supabase-auth';
import * as userModel from '../../models/user';
import * as workspaceModel from '../../models/workspace.model';

const sign = (p: object) => jwt.sign(p, 'test-supabase-secret', { algorithm: 'HS256' });
const domainUser = { id: 'u1', email: 'a@b.com', name: null, createdAt: '', hasPassword: false, role: 'user', suspendedAt: null };

beforeEach(() => jest.clearAllMocks());

describe('verifySupabaseToken', () => {
  it('is enabled when the secret is set', () => {
    expect(isSupabaseAuthEnabled()).toBe(true);
  });

  it('extracts identity from a valid token', () => {
    const token = sign({ sub: 'sb-1', email: 'a@b.com', aud: 'authenticated', user_metadata: { full_name: 'Ada' } });
    expect(verifySupabaseToken(token)).toEqual({ supabaseUserId: 'sb-1', email: 'a@b.com', name: 'Ada' });
  });

  it('rejects a token signed with the wrong secret', () => {
    const bad = jwt.sign({ sub: 'sb-1' }, 'other-secret', { algorithm: 'HS256' });
    expect(() => verifySupabaseToken(bad)).toThrow();
  });

  it('rejects a token with no subject', () => {
    expect(() => verifySupabaseToken(sign({ email: 'a@b.com' }))).toThrow(/subject/);
  });

  it('rejects an unexpected audience', () => {
    expect(() => verifySupabaseToken(sign({ sub: 'sb-1', aud: 'other' }))).toThrow(/audience/);
  });
});

describe('resolveDomainUser', () => {
  const identity = { supabaseUserId: 'sb-1', email: 'a@b.com', name: 'Ada' };

  it('returns the user already linked by auth id', async () => {
    (userModel.findByAuthId as jest.Mock).mockResolvedValue(domainUser);
    expect(await resolveDomainUser(identity)).toBe(domainUser);
    expect(userModel.createFromAuth).not.toHaveBeenCalled();
  });

  it('links an existing user matched by email (migration bridge)', async () => {
    (userModel.findByAuthId as jest.Mock).mockResolvedValue(null);
    (userModel.findByEmail as jest.Mock).mockResolvedValue(domainUser);
    const out = await resolveDomainUser(identity);
    expect(out).toBe(domainUser);
    expect(userModel.linkAuthUserId).toHaveBeenCalledWith('u1', 'sb-1');
    expect(userModel.createFromAuth).not.toHaveBeenCalled();
  });

  it('creates a new user + personal workspace when none exists', async () => {
    (userModel.findByAuthId as jest.Mock).mockResolvedValue(null);
    (userModel.findByEmail as jest.Mock).mockResolvedValue(null);
    (userModel.createFromAuth as jest.Mock).mockResolvedValue({ ...domainUser, id: 'u-new' });
    const out = await resolveDomainUser(identity);
    expect(out.id).toBe('u-new');
    expect(userModel.createFromAuth).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Ada', authUserId: 'sb-1' });
    expect(workspaceModel.ensurePersonalWorkspace).toHaveBeenCalledWith('u-new');
  });
});
