import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '../ui/Loader';
import { Header } from './Header';
import { Footer } from './Footer';

export function StorefrontLayout() {
  return (
    <div className="isolate flex min-h-screen flex-col">
      {/* Soft colour glows fixed behind the whole page: they are what the frosted-glass surfaces refract.
          (The wrapper above is `isolate` so this layer sits above the <body> background, not under it.) */}
      <div aria-hidden="true" className="ambient-bg" />
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
