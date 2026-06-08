/**
 * Tests for OAuth CSRF state (S2): /auth/google sets a state cookie + state param,
 * and the callback rejects requests whose state doesn't match the cookie.
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn(), signToken: jest.fn().mockReturnValue('jwt'),
  hashPassword: jest.fn(), comparePassword: jest.fn(),
}));
jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

import app from '../../index';

describe('GET /auth/google', () => {
  it('sets an oauth_state cookie and redirects to Google with a state param', async () => {
    const res = await request(app).get('/auth/google');
    expect(res.status).toBe(302);
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies.some(c => c.startsWith('oauth_state='))).toBe(true);
    expect(res.headers.location).toMatch(/state=/);
  });
});

describe('GET /auth/google/callback (CSRF state)', () => {
  it('redirects with oauth_state error when no state cookie is present', async () => {
    const res = await request(app).get('/auth/google/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=oauth_state/);
  });

  it('redirects with oauth_state error when state does not match the cookie', async () => {
    const res = await request(app)
      .get('/auth/google/callback?code=abc&state=attacker')
      .set('Cookie', 'oauth_state=legit');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=oauth_state/);
  });
});
