import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      {/* Gradient badge */}
      <div className="mb-6">
        <svg width="64" height="64" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="nf-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818CF8"/>
              <stop offset="100%" stopColor="#4338CA"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#nf-g)"/>
          <rect x="8" y="7" width="16" height="10" rx="2.5" fill="white" fillOpacity="0.35" transform="rotate(-6 16 12)"/>
          <rect x="7" y="12" width="16" height="10" rx="2.5" fill="white"/>
          <rect x="9" y="14.5" width="5" height="3.5" rx="1" fill="#C7D2FE"/>
          <rect x="9" y="19" width="10" height="1.5" rx="0.75" fill="#E0E7FF"/>
          <circle cx="23" cy="9" r="4.5" fill="#312E81" fillOpacity="0.9"/>
          <path d="M 23 5.5 A 3.5 3.5 0 1 1 19.8 11.5" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          <path d="M 18.8 10.3 L 19.8 11.5 L 21.3 10.8" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <p className="text-8xl font-black text-indigo-100 leading-none select-none" aria-hidden="true">404</p>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-500 max-w-sm">
        This page doesn't exist or may have been moved. Let's get you back on track.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Go home
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center text-gray-600 font-medium px-6 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
