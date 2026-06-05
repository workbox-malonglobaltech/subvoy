import { Link } from 'react-router-dom';

interface EmptyStateProps {
  onAddClick: () => void;
}

export function EmptyState({ onAddClick }: EmptyStateProps) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      {/* Illustration */}
      <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">No subscriptions yet</h2>
      <p className="text-gray-500 text-sm max-w-sm mb-8">
        Track all your recurring payments in one place. Add them manually or import from a bank statement.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add subscription
        </button>
        <Link
          to="/import"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import from bank CSV
        </Link>
      </div>

      {/* Steps hint */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-lg text-left">
        {[
          { num: '1', title: 'Add subscriptions', desc: 'Manually enter Netflix, Spotify, AWS, and more.' },
          { num: '2', title: 'Get reminders', desc: 'Email alerts before each payment is due.' },
          { num: '3', title: 'Track your spend', desc: 'See monthly totals and trends on the analytics page.' },
        ].map(step => (
          <div key={step.num} className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {step.num}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{step.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
