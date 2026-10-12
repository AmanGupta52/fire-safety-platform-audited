import toast from 'react-hot-toast';

/**
 * Toast for a request that got no answer (timeout or network failure) with an explicit Retry button.
 * Retrying is always the person's choice: nothing here re-sends a POST on its own.
 */
export function showNetworkRetryToast(message: string, onRetry: () => void): void {
  toast.custom(
    (t) => (
      <div role="alert" className="flex max-w-sm items-center gap-3 rounded-card border border-line bg-card px-4 py-3 text-[13px] text-ink shadow-popover">
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={() => { toast.dismiss(t.id); onRetry(); }}
          className="shrink-0 rounded-btn bg-ink px-3 py-1.5 text-xs font-medium text-on-ink hover:bg-ink-soft"
        >
          Retry
        </button>
      </div>
    ),
    { id: 'network-retry', duration: 12_000 }
  );
}
