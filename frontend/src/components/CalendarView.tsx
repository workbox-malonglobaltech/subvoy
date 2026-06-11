import { useState, useMemo } from 'react';
import { Subscription, ComplianceItem } from '../../../src/shared/types';

interface Props {
  subscriptions: Subscription[];
  /** Optional compliance obligations to overlay (Business workspaces). */
  complianceItems?: ComplianceItem[];
}

type EventKind = 'payment' | 'compliance';

interface CalEvent {
  id: string;
  date: string;        // YYYY-MM-DD
  title: string;
  detail: string;
  kind: EventKind;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

/** Dot/urgency colour — red imminent, amber soon, else kind base colour. */
function dotColor(ev: CalEvent): string {
  const d = daysUntil(ev.date);
  if (d <= 3) return 'bg-red-400';
  if (d <= 7) return 'bg-amber-400';
  return ev.kind === 'compliance' ? 'bg-emerald-400' : 'bg-indigo-400';
}

export function CalendarView({ subscriptions, complianceItems = [] }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [expanded, setExpanded] = useState<number | null>(null);

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Unified event model across payments + compliance.
  const events = useMemo<CalEvent[]>(() => {
    const payments: CalEvent[] = subscriptions.map(s => ({
      id: `s-${s.id}`,
      date: s.nextBillingDate,
      title: s.name,
      detail: new Intl.NumberFormat('en-US', { style: 'currency', currency: s.currency }).format(s.amount),
      kind: 'payment',
    }));
    const compliance: CalEvent[] = complianceItems
      .filter(c => c.status !== 'completed')
      .map(c => ({
        id: `c-${c.id}`,
        date: c.dueDate,
        title: c.title,
        detail: c.authority ?? 'Compliance',
        kind: 'compliance',
      }));
    return [...payments, ...compliance];
  }, [subscriptions, complianceItems]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(ev);
      }
    }
    return map;
  }, [events, year, month]);

  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const hasCompliance = complianceItems.length > 0;

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Previous month">‹</button>
        <h3 className="text-sm font-semibold text-gray-800">{monthLabel}</h3>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" aria-label="Next month">›</button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-fg-subtle uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
        {cells.map((day, idx) => {
          const evs = day ? (eventsByDay.get(day) ?? []) : [];
          const isToday = day === todayDay;
          const isExpanded = day === expanded;
          return (
            <div
              key={idx}
              onClick={() => day && evs.length > 0 && setExpanded(isExpanded ? null : day)}
              className={`bg-white min-h-[48px] p-1 relative
                ${day && evs.length > 0 ? 'cursor-pointer hover:bg-indigo-50/50' : ''}
                ${isExpanded ? 'bg-indigo-50' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full
                    ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  {evs.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {evs.slice(0, 3).map((ev, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotColor(ev)}`} aria-hidden="true" />
                      ))}
                      {evs.length > 3 && <span className="text-[8px] text-fg-subtle">+{evs.length - 3}</span>}
                    </div>
                  )}
                  {isExpanded && evs.length > 0 && (
                    <div className="absolute top-full left-0 z-20 mt-1 min-w-[180px] bg-white rounded-xl shadow-lg border border-gray-200 p-2 space-y-1.5">
                      {evs.map(ev => (
                        <div key={ev.id} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${ev.kind === 'compliance' ? 'bg-emerald-500' : 'bg-indigo-500'}`} aria-hidden="true" />
                            <p className="font-medium text-gray-800 truncate">{ev.title}</p>
                          </div>
                          <p className="text-gray-500 pl-3">{ev.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Payment</span>
        {hasCompliance && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Compliance</span>}
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Due soon</span>
      </div>
    </div>
  );
}
