import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageLoader } from '../ui/Loader';
import { Header } from './Header';
import { Footer } from './Footer';

export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
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
