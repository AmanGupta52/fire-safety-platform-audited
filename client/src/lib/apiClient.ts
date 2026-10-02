import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/authStore';
import { redirectTo } from './navigation';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL
  // See admin/src/lib/apiClient.ts for why there's no fixed Content-Type default here —
  // it silently breaks any future FormData/file-upload request from this client.
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

// Endpoints that are fetched in the background on essentially every storefront page (the
// header's category mega-menu, and the cart/wishlist item counts) rather than being a page's
// actual content. If one of these fails, the component that owns it already degrades
// gracefully on its own (an empty count badge, a missing mega-menu), so a global redirect here
// would do the opposite of what's needed — it would hijack whichever real page the shopper is
// looking at just because a minor background widget hiccuped. The Cart and Wishlist pages
// themselves use these same endpoints as their actual content, but they already handle a
// missing result by showing their own empty state, so leaving them out of the global redirect
// here doesn't take anything away from those pages either.
const BACKGROUND_GET_PATHS = ['/categories', '/cart', '/wishlist', '/settings'];

function isBackgroundGet(url?: string) {
  return Boolean(url && BACKGROUND_GET_PATHS.some((p) => url.startsWith(p)));
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = res.data.data;
    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    useAuthStore.getState().logout();
    // There was a session to lose (we had a refresh token) and it's no longer valid — send
    // the person to the dedicated "session ended" screen rather than leaving whatever account
    // page they were on silently broken, or dumping them on the bare login form with no context.
    redirectTo('/401');
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && useAuthStore.getState().refreshToken) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => (refreshPromise = null));
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers || {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      return Promise.reject(error);
    }

    // Everything below only applies to page-loading GET requests. A mutation (placing an
    // order, adding to cart, submitting a form) that hits a permission wall or a server
    // hiccup should surface as an inline toast via apiErrorMessage() at the call site, not
    // yank the shopper away from checkout or a half-filled form.
    const method = original?.method?.toLowerCase();
    if (method === 'get' && !isBackgroundGet(original?.url)) {
      if (error.response?.status === 403) {
        redirectTo('/403');
      } else if (!error.response) {
        // Request never got a response at all — the API is unreachable (down, network
        // offline, CORS misconfiguration, timeout), which reads to a shopper as "the site is
        // broken" rather than "this one page failed to load".
        redirectTo('/503');
      } else if (error.response.status >= 500) {
        redirectTo('/500');
      }
    }

    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as any)?.message || err.message || 'Something went wrong';
  }
  return 'Something went wrong';
}
