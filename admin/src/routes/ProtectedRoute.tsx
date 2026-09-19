import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Permission } from '../types';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: Permission }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (!accessToken) return <Navigate to="/login" replace />;

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <ShieldAlert className="h-6 w-6 text-brand" />
        <p className="page-heading text-base text-ink">You don't have access to this page</p>
        <p className="text-sm text-slateink">Ask an administrator to grant the relevant permission if you need it.</p>
      </div>
    );
  }

  return <>{children}</>;
}
