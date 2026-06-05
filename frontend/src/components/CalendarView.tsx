import { useState, useMemo } from 'react';
import { Subscription } from '../../../src/shared/types';

interface Props {
  subscriptions: Subscription[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
}

export function CalendarView({ subscriptions }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Build calendar grid: pad with nulls before first day
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full 6-row grid
  while (cells.length % 7 !== 0) cells.push(null);

  // Map day-of-month → subscriptions due on that day
  const subsByDay = useMemo(() => {
    const map = new Map<number, Subscription[]>();
    for (const sub of subscriptions) {
      const d = new Date(sub.nextBillingDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(sub);
      }
    }
    return map;
  }, [subscriptions, year, month]);

  const [expanded, setExpanded] = useState<number | null>(null);

  const todayDay = today.getFullYear() === year && today.getMonth() === month
    ? today.getDate()
    : null;

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-gray-800">{monthLabel}</h3>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
        {cells.map((day, idx) => {
          const subs = day ? (subsByDay.get(day) ?? []) : [];
          const isToday = day === todayDay;
          const isExpanded = day === expanded;

          return (
            <div
              key={idx}
              onClick={() => day && subs.length > 0 && setExpanded(isExpanded ? null : day)}
              className={`
                bg-white min-h-[48px] p-1 relative
                ${day && subs.length > 0 ? 'cursor-pointer hover:bg-indigo-50/50' : ''}
                ${isExpanded ? 'bg-indigo-50' : ''}
              `}
            >
              {day && (
                <>
                  <span className={`
                    text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full
                    ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}
                  `}>
                    {day}
                  </span>
                  {/* Dot indicators for subscriptions due */}
                  {subs.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {subs.slice(0, 3).map((s, i) => {
                        const days = daysUntil(s.nextBillingDate);
                        return (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              days <= 3 ? 'bg-red-400' : days <= 7 ? 'bg-amber-400' : 'bg-indigo-400'
                            }`}
                            aria-hidden="true"
                          />
                        );
                      })}
                      {subs.length > 3 && (
                        <span className="text-[8px] text-gray-400">+{subs.length - 3}</span>
                      )}
                    </div>
                  )}
                  {/* Expanded sub list */}
                  {isExpanded && subs.length > 0 && (
                    <div className="absolute top-full left-0 z-20 mt-1 min-w-[160px] bg-white rounded-xl shadow-lg border border-gray-200 p-2 space-y-1">
                      {subs.map(s => (
                        <div key={s.id} className="text-xs">
                          <p className="font-medium text-gray-800 truncate">{s.name}</p>
                          <p className="text-gray-500">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: s.currency }).format(s.amount)}
                          </p>
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

      <p className="text-xs text-gray-400 mt-2 text-center">Click a day with dots to see due subscriptions</p>
    </div>
  );
}
