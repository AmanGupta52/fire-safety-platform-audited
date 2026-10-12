import { Loader2 } from 'lucide-react';
import { useServerStatusStore } from '../../store/serverStatusStore';

/** Non-blocking notice shown while an API request is taking unusually long (server cold start). */
export function ServerWakingBanner() {
  const waking = useServerStatusStore((s) => s.slowRequestIds.length > 0);
  if (!waking) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex max-w-md items-center gap-2.5 rounded-card border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-popover">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber" aria-hidden="true" />
        <span>Server is waking up, this can take up to a minute...</span>
      </div>
    </div>
  );
}
