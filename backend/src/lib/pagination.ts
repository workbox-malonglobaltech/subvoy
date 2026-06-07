/** Shared pagination bounds for list endpoints — caps unbounded reads. */
export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 500;

export function clampLimit(limit?: number): number {
  if (!limit || limit <= 0 || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export function safeOffset(offset?: number): number {
  if (!offset || offset <= 0 || Number.isNaN(offset)) return 0;
  return Math.floor(offset);
}
