import { useSearchParams, Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

/**
 * Return target after a hosted checkout. The plan is activated server-side by the
 * provider webhook (may land a moment after this redirect), so we just confirm
 * receipt and point the user back.
 */
export function BillingCallbackPage() {
  const [params] = useSearchParams();
  const status = params.get('status');
  const cancelled = status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="flex justify-center mb-5"><LogoMark linked={false} /></div>
        {cancelled ? (
          <>
            <h1 className="text-lg font-bold text-gray-900">Checkout cancelled</h1>
            <p className="text-sm text-gray-500 mt-1">No charge was made. You can pick a plan whenever you're ready.</p>
            <Link to="/plans" className="inline-block mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Back to plans →</Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Payment received</h1>
            <p className="text-sm text-gray-500 mt-1">
              Thanks! Your plan will be active within a moment once payment is confirmed.
            </p>
            <Link to="/" className="inline-block mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
