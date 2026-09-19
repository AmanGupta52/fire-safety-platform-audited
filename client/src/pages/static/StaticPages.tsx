import { Link } from 'react-router-dom';
import { FlameKindling } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function PrivacyPage() {
  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="heading text-2xl text-ink">Privacy policy</h1>
      <p className="mt-2 text-xs text-slateink">This is placeholder policy text for development. Replace with your company's reviewed legal copy before going live.</p>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-slateink">
        <p>We collect the information you provide when creating an account, placing an order, requesting a quote or booking a service — such as your name, contact details, delivery address and, where applicable, GST details.</p>
        <p>This information is used to fulfil orders, provide services, send order and service-related notifications, and improve our offering. We do not sell personal information to third parties.</p>
        <p>You may request access to, correction of, or deletion of your personal data by contacting us using the details on our Contact page.</p>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="container-page max-w-2xl py-10">
      <h1 className="heading text-2xl text-ink">Terms of service</h1>
      <p className="mt-2 text-xs text-slateink">This is placeholder terms text for development. Replace with your company's reviewed legal copy before going live.</p>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-slateink">
        <p>By using this platform to purchase products or book services, you agree to provide accurate information and to make payment by the method selected at checkout.</p>
        <p>Orders are subject to product availability. Prices include GST as configured for each product; delivery timelines are indicative and may vary by location.</p>
        <p>Service bookings are confirmed subject to technician availability. Cancellations are accepted for orders that have not yet been dispatched.</p>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light"><FlameKindling className="h-6 w-6 text-brand" /></div>
      <h1 className="heading text-2xl text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-slateink">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/"><Button>Back to home</Button></Link>
    </div>
  );
}
