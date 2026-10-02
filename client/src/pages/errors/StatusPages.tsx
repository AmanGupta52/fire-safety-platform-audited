import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, ShieldAlert, LockKeyhole, SearchX, ServerCrash, CloudOff } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/**
 * Shared layout for every full-page HTTP-status screen (401/403/404/500/503), so the five
 * error states look and behave consistently with each other and with the rest of the storefront
 * instead of each page inventing its own spacing and button placement.
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
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-safety-light">
        <Icon className="h-6 w-6 text-safety" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slateink">Error {code}</p>
      <h1 className="heading text-2xl text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-slateink">{description}</p>
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={onPrimary}>{primaryLabel}</Button>
        {secondary}
      </div>
    </div>
  );
}

/** Session expired, or an account page was opened without being logged in. */
export function Unauthorized401() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={LockKeyhole}
      code="401"
      title="Please sign in again"
      description="Your session has ended. Sign in again to pick up where you left off."
      primaryLabel="Sign in"
      onPrimary={() => navigate('/login', { replace: true })}
    />
  );
}

/** Something exists, but this account isn't allowed to see it (e.g. another customer's order). */
export function Forbidden403() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={ShieldAlert}
      code="403"
      title="You don't have access to this"
      description="This page isn't available for your account. If you think this is a mistake, contact us."
      primaryLabel="Back to home"
      onPrimary={() => navigate('/', { replace: true })}
    />
  );
}

/** Unmatched route, or a specific product/service/post that no longer exists. */
export function NotFound404() {
  const navigate = useNavigate();
  return (
    <StatusScreen
      icon={SearchX}
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      primaryLabel="Back to home"
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
      description="An unexpected error occurred on our end. Please try again in a moment."
      primaryLabel="Try again"
      onPrimary={() => window.location.reload()}
      secondary={<Button variant="secondary" onClick={() => navigate('/', { replace: true })}>Back to home</Button>}
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
      description="Our site may be temporarily down for maintenance, or your connection may be offline. Please try again shortly."
      primaryLabel="Retry"
      onPrimary={() => window.location.reload()}
    />
  );
}
