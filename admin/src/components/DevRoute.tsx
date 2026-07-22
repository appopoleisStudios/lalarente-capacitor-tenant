import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Route guard for /dev/* pages.
 * Only renders children if the current user has dev_admin = true.
 * Otherwise redirects to the dashboard.
 */
export default function DevRoute({ children }: { children: React.ReactNode }) {
  const { isDevAdmin } = useAuth();

  if (!isDevAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
