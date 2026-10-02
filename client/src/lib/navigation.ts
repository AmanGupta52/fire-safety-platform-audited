import type { NavigateFunction } from 'react-router-dom';

// The axios response interceptor in apiClient.ts needs to redirect to the /401, /403, /500 and
// /503 status pages, but it runs outside any React component and so has no access to
// react-router's useNavigate(). NavigateRegistrar (mounted once in App.tsx, inside
// BrowserRouter) stores the real navigate function here the moment the router is ready, so the
// interceptor can do a normal client-side route change instead of a jarring full page reload.
let navigateRef: NavigateFunction | null = null;

export function setNavigate(fn: NavigateFunction) {
  navigateRef = fn;
}

/**
 * Navigate to a status/error page from anywhere, including outside React. Falls back to a full
 * page load only in the unlikely case this runs before the router has mounted. Never redirects
 * again if we're already on that exact page, so a second failing request can't loop navigation.
 */
export function redirectTo(path: string) {
  if (window.location.pathname === path) return;
  if (navigateRef) navigateRef(path, { replace: true });
  else window.location.assign(path);
}
