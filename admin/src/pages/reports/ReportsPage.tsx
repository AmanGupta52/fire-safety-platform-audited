import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Users, ShieldCheck, Wrench } from 'lucide-react';
import { api, API_BASE_URL } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, StatCard } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';

interface TopProduct { _id: string; name: string; revenue: number; unitsSold: number }
interface TopCustomer { _id: string; name: string; email: string; totalSpent: number; orderCount: number }
interface RenewalRate { expired: number; renewed: number; renewalRate: number }
interface CompletionRate { total: number; completed: number; pending: number; completionRate: number }

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function ReportsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: topProducts } = useQuery({
    queryKey: ['report-top-products'],
    queryFn: async () => (await api.get('/reports/top-products?limit=8')).data.data as TopProduct[]
  });
  const { data: topCustomers } = useQuery({
    queryKey: ['report-top-customers'],
    queryFn: async () => (await api.get('/reports/top-customers?limit=8')).data.data as TopCustomer[]
  });
  const { data: renewalRate } = useQuery({
    queryKey: ['report-amc-renewal'],
    queryFn: async () => (await api.get('/reports/amc-renewal-rate')).data.data as RenewalRate
  });
  const { data: completionRate } = useQuery({
    queryKey: ['report-service-completion'],
    queryFn: async () => (await api.get('/reports/service-completion-rate')).data.data as CompletionRate
  });

  async function downloadCsv() {
    const res = await fetch(`${API_BASE_URL}/reports/export/orders.csv`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Deeper performance metrics beyond the dashboard overview."
        actions={<Button variant="secondary" onClick={downloadCsv}><Download className="h-3.5 w-3.5" /> Export orders CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="AMC renewal rate" value={renewalRate?.renewalRate ?? 0} suffix="%" icon={ShieldCheck} accent="forest" />
        <StatCard label="AMC expired" value={renewalRate?.expired ?? 0} icon={ShieldCheck} accent="brand" />
        <StatCard label="Service completion rate" value={completionRate?.completionRate ?? 0} suffix="%" icon={Wrench} accent="forest" />
        <StatCard label="Services pending" value={completionRate?.pending ?? 0} icon={Wrench} accent="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="page-heading flex items-center gap-2 text-sm text-ink"><TrendingUp className="h-4 w-4" /> Top products by revenue</p>
          <div className="mt-4 space-y-3">
            {(topProducts || []).map((p, i) => (
              <div key={p._id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs text-slateink">{i + 1}</span>
                  <div>
                    <p className="text-ink">{p.name}</p>
                    <p className="text-xs text-slateink">{p.unitsSold} units sold</p>
                  </div>
                </div>
                <p className="font-medium text-ink">{formatInr(p.revenue)}</p>
              </div>
            ))}
            {(!topProducts || topProducts.length === 0) && <p className="text-sm text-slateink">No sales data yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <p className="page-heading flex items-center gap-2 text-sm text-ink"><Users className="h-4 w-4" /> Top customers by spend</p>
          <div className="mt-4 space-y-3">
            {(topCustomers || []).map((c, i) => (
              <div key={c._id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs text-slateink">{i + 1}</span>
                  <div>
                    <p className="text-ink">{c.name}</p>
                    <p className="text-xs text-slateink">{c.orderCount} orders</p>
                  </div>
                </div>
                <p className="font-medium text-ink">{formatInr(c.totalSpent)}</p>
              </div>
            ))}
            {(!topCustomers || topCustomers.length === 0) && <p className="text-sm text-slateink">No customer data yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
