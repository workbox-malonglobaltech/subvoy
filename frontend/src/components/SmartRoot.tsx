import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LandingPage } from '../pages/LandingPage';

interface Props {
  /** The authenticated view — rendered when the user is logged in. */
  children: ReactNode;
}

/**
 * SmartRoot — renders the landing page for guests, or the children (Dashboard)
 * for authenticated users. No redirect needed; `/` works for both audiences.
 */
export function SmartRoot({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <>{children}</>;
}
