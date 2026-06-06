import { canUseKind, allowsTeams, enabledKinds } from '../../lib/capabilities';

describe('workspace capabilities', () => {
  it('personal workspaces allow payments but not compliance', () => {
    expect(canUseKind('personal', 'payment')).toBe(true);
    expect(canUseKind('personal', 'compliance')).toBe(false);
  });

  it('business workspaces allow both payments and compliance', () => {
    expect(canUseKind('business', 'payment')).toBe(true);
    expect(canUseKind('business', 'compliance')).toBe(true);
  });

  it('only business workspaces support teams', () => {
    expect(allowsTeams('personal')).toBe(false);
    expect(allowsTeams('business')).toBe(true);
  });

  it('exposes the enabled kinds per type', () => {
    expect(enabledKinds('personal')).toEqual(['payment']);
    expect(enabledKinds('business')).toEqual(['payment', 'compliance']);
  });
});
