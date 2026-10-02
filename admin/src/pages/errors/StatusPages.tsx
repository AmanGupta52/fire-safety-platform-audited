import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, ShieldAlert, LockKeyhole, SearchX, ServerCrash, CloudOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * Shared layout for every full-page HTTP-status screen (401/403/404/500/503). Kept as one
 * component so the five error states look and behave consistently instead of each page
 * re-inventing its own spacing, icon treatment and button placement.
 */
function StatusScreen({
  icon: Icon, code, title, description, primaryLabel, onPrimary, secondary
}: {
  icon: LucideIcon;
  code: string;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondary?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
        <Icon className="h-6 w-6 text-brand" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slateink">Error {code}</p>
      <h1 className="page-heading text-2xl text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-slateink">{description}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={onPrimary}>{primaryLabel}</Button>
        {secondary}
      </div>
    </div>
  );
}

/** Session expired, or never logged in when a page required it. Full-bleed, like /login. */
export function Unauthorized401() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={LockKeyhole}
      code="401"
      title="Your session has ended"
      description="For your security, please sign in again to continue."
      primaryLabel="Sign in"
      onPrimary={() => navigate('/login', { replace: true })}
    />
  );
}

/** Logged in, but not allowed here. Rendered inline within the app shell by ProtectedRoute,
 *  and also reachable as its own route for API-level 403s (e.g. someone else's record). */
export function Forbidden403() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={ShieldAlert}
      code="403"
      title="You don't have access to this"
      description="Ask an administrator to grant the relevant permission if you believe this is a mistake."
      primaryLabel="Back to dashboard"
      onPrimary={() => navigate('/', { replace: true })}
    />
  );
}

/** Unmatched route, or a specific record that no longer exists. */
export function NotFound404() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={SearchX}
      code="404"
      title="Page not found"
      description="The page or record you're looking for doesn't exist, or may have moved."
      primaryLabel="Back to dashboard"
      onPrimary={() => navigate('/', { replace: true })}
    />
  );
}

/** The server reached us but hit an unhandled error. */
export function ServerError500() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={ServerCrash}
      code="500"
      title="Something went wrong"
      description="An unexpected error occurred on our end. It's been logged — please try again."
      primaryLabel="Try again"
      onPrimary={() => window.location.reload()}
      secondary={<Button variant="secondary" onClick={() => navigate('/', { replace: true })}>Back to dashboard</Button>}
    />
  );
}

/** We couldn't reach the server at all (down, or a network/connectivity failure). */
export function ServiceUnavailable503() {
  return (
    <StatusScreen
      icon={CloudOff}
      code="503"
      title="We can't reach the server"
      description="The service may be temporarily down for maintenance, or your connection may be offline. Please try again shortly."
      primaryLabel="Retry"
      onPrimary={() => window.location.reload()}
    />
  );
}
