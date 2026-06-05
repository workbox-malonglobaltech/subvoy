import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user || (user.role !== 'staff' && user.role !== 'superadmin')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
