import { Component, ErrorInfo, ReactNode } from 'react';
import { ServerError500 } from '../pages/errors/StatusPages';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * React only unmounts the crashed component tree on an uncaught render error — without a
 * boundary somewhere above it, that tree is the whole app, so the browser tab goes blank with
 * nothing but a stack trace in the console. This wraps everything once, at the root, so any
 * such crash shows the same 500 page a real server error would, with a way back to safety.
 * Route-level errors (bad API responses, permission failures) are handled separately by
 * apiClient.ts and never reach this — this is only for genuine JavaScript exceptions during
 * render.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return <ServerError500 />;
    return this.props.children;
  }
}
