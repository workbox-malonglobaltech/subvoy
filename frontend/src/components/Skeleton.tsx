/** Generic + specialised skeleton shapes used across loading states. */

// ── Primitive ─────────────────────────────────────────────────────────────────

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-lg ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ── Stat card (Dashboard × 4, Analytics × 3) ──────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm" aria-hidden="true">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-28 mt-2" />
      <Skeleton className="h-3 w-16 mt-2" />
    </div>
  );
}

// ── Subscription card (Dashboard list) ───────────────────────────────────────

export function SubscriptionCardSkeleton() {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />

        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          {/* Name + badge */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Amount */}
          <div className="space-y-1.5 text-right">
            <Skeleton className="h-5 w-16 ml-auto" />
            <Skeleton className="h-3 w-8 ml-auto" />
          </div>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

// ── Analytics chart placeholder ────────────────────────────────────────────────

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="w-full animate-shimmer rounded-xl"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

// ── Transaction row (Wallet history) ──────────────────────────────────────────

export function TransactionRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5" aria-hidden="true">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1.5 text-right">
        <Skeleton className="h-4 w-16 ml-auto" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
    </li>
  );
}
