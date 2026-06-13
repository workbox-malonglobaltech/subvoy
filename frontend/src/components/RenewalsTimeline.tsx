import { Subscription } from '../../../src/shared/types';

interface Props {
  subscriptions: Subscription[];
}

/** Compact rail card: a month strip with a "today" marker and a dot per renewal. */
export function RenewalsTimeline({ subscriptions }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = now.getDate();
  const span = Math.max(daysInMonth - 1, 1);

  const renewals = subscriptions
    .filter(s => s.isActive)
    .map(s => ({ sub: s, date: new Date(s.nextBillingDate) }))
    .filter(({ date }) => date.getFullYear() === year && date.getMonth() === month)
    .map(({ sub, date }) => ({ sub, day: date.getDate() }))
    .sort((a, b) => a.day - b.day);

  if (renewals.length === 0) return null;

  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="bg-surface rounded-2xl border border-line p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg-muted">Renewals · {monthName}</h2>
        <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-xs font-semibold text-primary-700">{renewals.length}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-muted">
        {/* today marker */}
        <div
          className="absolute top-1/2 z-10 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-fg-subtle"
          style={{ left: `${((todayDay - 1) / span) * 100}%` }}
          title="Today"
        />
        {/* renewal dots */}
        {renewals.map(({ sub, day }) => (
          <div
            key={sub.id}
            title={`${sub.name} · ${monthName} ${day}`}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${
              day < todayDay ? 'bg-fg-subtle' : 'bg-primary'
            }`}
            style={{ left: `${((day - 1) / span) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-fg-subtle">
        <span>{monthName.slice(0, 3)} 1</span>
        <span>{monthName.slice(0, 3)} {daysInMonth}</span>
      </div>
    </div>
  );
}
