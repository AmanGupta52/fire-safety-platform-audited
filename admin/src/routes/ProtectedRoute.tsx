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

  // `permission` checks the signed-in user's effective permissions (role defaults plus any
  // per-user overrides granted in Staff & Roles) — this is what every route should use, since
  // it's the same check the backend API enforces. `roles` is a plain role allow-list for the
  // rare case a page has no permission of its own to gate on.
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
