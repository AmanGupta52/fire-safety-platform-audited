import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { redirectTo } from './navigation';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL
  // Deliberately no default Content-Type header here. Axios sets 'application/json'
  // automatically for plain object payloads (see its transformRequest), but only when this
  // instance doesn't already carry a fixed Content-Type — a fixed one make it treat every
  // request as JSON, including FormData uploads, which silently JSON.stringifies away the
  // actual file bytes to "{}" instead of sending multipart/form-data. That was the real
  // reason every direct image upload (Products/Categories/Blog/Gallery) failed with
  // "No file provided", regardless of the image itself.
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

// Endpoints that are fetched in the background on essentially every admin page (the
// notification bell in Topbar) rather than being a page's actual content. If one of these
// fails, the component that owns it already degrades gracefully on its own (an empty bell),
// so a global redirect here would do the opposite of what's needed — it would hijack whichever
// real page the person is looking at just because a minor background widget hiccuped.
const BACKGROUND_GET_PATHS = ['/notifications'];

function isBackgroundGet(url?: string) {
  return Boolean(url && BACKGROUND_GET_PATHS.some((p) => url.startsWith(p)));
}

async function refreshAccessToken(failedAccessToken?: string | null): Promise<string | null> {
  // Another tab may already have refreshed (refresh tokens rotate: each one works exactly once). Reload the
  // stored session first; if it now holds a different access token, use that instead of refreshing again.
  await useAuthStore.persist.rehydrate();
  const current = useAuthStore.getState();
  if (current.accessToken && failedAccessToken && current.accessToken !== failedAccessToken) {
    return current.accessToken;
  }

  const refreshToken = current.refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = res.data.data;
    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch (err) {
    // A network failure or a 5xx is not "your session ended": keep the person signed in and let the original
    // request fail normally. Only an explicit rejection of the refresh token ends the session.
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (!status || status >= 500) return null;

    // Two tabs refreshing at the same instant: one wins and the other is told "just refreshed". Give the winner a
    // moment to store its new tokens, then use them instead of signing this tab out.
    if (status === 401) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await useAuthStore.persist.rehydrate();
      const latest = useAuthStore.getState();
      if (latest.accessToken && latest.refreshToken && latest.refreshToken !== refreshToken) {
        return latest.accessToken;
      }
    }

    useAuthStore.getState().logout();
    // There was a session to lose (we had a refresh token) and it's no longer valid — send
    // the person to the dedicated "session ended" screen rather than leaving whatever page
    // they were on silently broken, or dumping them on the bare login form with no context.
    redirectTo('/401');
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshPromise) {
        const failedToken = String((original.headers as Record<string, unknown> | undefined)?.Authorization || '').replace(/^Bearer\s+/i, '') || null;
        refreshPromise = refreshAccessToken(failedToken).finally(() => (refreshPromise = null));
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers || {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      return Promise.reject(error);
    }

    // Everything below only applies to page-loading GET requests. A mutation (create/update/
    // delete) that hits a permission wall or a server hiccup should surface as an inline toast
    // via apiErrorMessage() at the call site, not yank the person away from a half-filled form.
    const method = original?.method?.toLowerCase();
    if (method === 'get' && !isBackgroundGet(original?.url)) {
      if (error.response?.status === 403) {
        redirectTo('/403');
      } else if (!error.response) {
        // Request never got a response at all — the API is unreachable (down, network offline,
        // CORS misconfiguration, timeout), which reads to the person as "the site is broken"
        // rather than "this one page failed to load".
        redirectTo('/503');
      } else if (error.response.status >= 500) {
        redirectTo('/500');
      }
    }

    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as any)?.message || err.message || 'Something went wrong';
  }
  return 'Something went wrong';
}

/**
 * Signs out for real: tells the server to revoke this login's refresh token (so a copied token stops working),
 * then clears the local session. The request is fire-and-forget so the UI never waits on the network, and a
 * failed request (offline, server down) still signs the person out locally.
 */
export function signOut(): void {
  const { refreshToken } = useAuthStore.getState();
  if (refreshToken) {
    axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken }, { timeout: 5000 }).catch(() => undefined);
  }
  useAuthStore.getState().logout();
  // Shared phones/tablets: ask the service worker to drop everything it stored.
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage('CLEAR_CACHES');
  }
}
