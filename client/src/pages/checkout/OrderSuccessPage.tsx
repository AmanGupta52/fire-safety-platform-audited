import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('orderNumber');

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-light">
        <CheckCircle2 className="h-8 w-8 text-forest" />
      </div>
      <h1 className="heading mt-5 text-2xl text-ink">Order placed successfully</h1>
      {orderNumber && <p className="mt-2 text-sm text-slateink">Order number <span className="font-medium text-ink">{orderNumber}</span></p>}
      <p className="mt-1 max-w-md text-sm text-slateink">
        We've emailed a confirmation and generated your invoice. You can track the status any time from your account.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/account/orders"><Button>View my orders</Button></Link>
        <Link to="/products"><Button variant="secondary">Continue shopping</Button></Link>
      </div>
    </div>
  );
}
