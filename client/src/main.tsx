import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import { initSentry } from './lib/sentry';
import { API_BASE_URL, apiErrorMessage, isNetworkError } from './lib/apiClient';
import { useAuthStore } from './store/authStore';
import { showNetworkRetryToast } from './components/ui/NetworkRetryToast';
import { ConfigError } from './components/ConfigError';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root')!;

// Fail loudly instead of quietly calling localhost: show a plain message and stop (see apiClient.ts / vite.config.ts).
if (!API_BASE_URL) {
  ReactDOM.createRoot(rootElement).render(<ConfigError />);
  throw new Error('App is misconfigured: VITE_API_URL is not set');
}

initSentry();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
  mutationCache: new MutationCache({
    // A mutation that got no answer (timeout / network down) is shown here, once, with a Retry button. The retry
    // happens only when the person presses it: a POST is never re-sent automatically, because we can't know
    // whether the first attempt already reached the server.
    onError: (error, variables, _context, mutation) => {
      if (!isNetworkError(error)) return;
      showNetworkRetryToast(apiErrorMessage(error), () => { mutation.execute(variables).catch(() => undefined); });
    }
  })
});

// Cached data belongs to whoever was signed in when it was fetched. When a different person signs in (or the session
// ends), throw it all away so one person's orders, addresses or customers never flash up for the next.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) void queryClient.resetQueries();
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px' } }} />
    </QueryClientProvider>
  </React.StrictMode>
);
