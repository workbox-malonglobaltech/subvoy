/**
 * Workspace capability map — the single source of truth for what a workspace
 * TYPE can do, independent of obligation KIND.
 *
 *   personal → payments only, no teams
 *   business → payments + compliance, teams
 *
 * Capability is enforced server-side (see workspace context middleware). Plan
 * tier gates depth (autopay, do-for-you, seats) separately — that lives with the
 * entitlements registry in Phase 2.
 */

import type { WorkspaceType, ObligationKind } from '../../../src/shared/types';

interface Capabilities {
  kinds: ObligationKind[];
  teams: boolean;
}

const CAPABILITIES: Record<WorkspaceType, Capabilities> = {
  personal: { kinds: ['payment'], teams: false },
  business: { kinds: ['payment', 'compliance'], teams: true },
};

/** True if a workspace of this type may contain obligations of this kind. */
export function canUseKind(type: WorkspaceType, kind: ObligationKind): boolean {
  return CAPABILITIES[type].kinds.includes(kind);
}

/** True if a workspace of this type supports multiple members / roles. */
export function allowsTeams(type: WorkspaceType): boolean {
  return CAPABILITIES[type].teams;
}

/** The obligation kinds enabled for a workspace type. */
export function enabledKinds(type: WorkspaceType): ObligationKind[] {
  return CAPABILITIES[type].kinds;
}
