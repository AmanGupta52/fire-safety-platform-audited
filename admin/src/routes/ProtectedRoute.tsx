import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Permission, Role } from '../types';
import { ShieldAlert } from 'lucide-react';

export function ProtectedRoute({
  children, permission, roles
}: { children: React.ReactNode; permission?: Permission; roles?: Role[] }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);

  if (!accessToken) return <Navigate to="/login" replace />;

  // Staff & Roles has no dedicated permission of its own — the backend gates it by role
  // directly (super_admin/admin only), so the frontend route needs the same role check
  // rather than a permission check, or any staff member could reach the page directly by URL.
  const roleAllowed = !roles || (user && roles.includes(user.role));
  const permissionAllowed = !permission || hasPermission(permission);

  if (!roleAllowed || !permissionAllowed) {
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
