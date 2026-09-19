import { useQuery } from '@tanstack/react-query';
import {
  IndianRupee, ShoppingCart, FileText, Users, ShieldAlert, Wrench, PackageX, Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { api } from '../../lib/apiClient';
import { StatCard, Card, Spinner } from '../../components/ui/Primitives';
import { PageHeader } from '../../components/layout/PageHeader';
import { DashboardSummary } from '../../types';
import { format } from 'date-fns';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get('/reports/dashboard')).data.data as DashboardSummary
  });

  const { data: revenueChart } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: async () => (await api.get('/reports/revenue-chart?days=30')).data.data as { _id: string; revenue: number; orders: number }[]
  });

  const { data: categoryChart } = useQuery({
    queryKey: ['sales-by-category'],
    queryFn: async () => (await api.get('/reports/sales-by-category')).data.data as { _id: string; revenue: number }[]
  });

  if (isLoading || !summary) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" description="A live view of revenue, orders and what needs your attention today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={formatInr(summary.totalRevenue)} icon={IndianRupee} accent="forest" />
        <StatCard label="Today's revenue" value={formatInr(summary.todayRevenue)} icon={IndianRupee} accent="ink" />
        <StatCard label="This month" value={formatInr(summary.monthlyRevenue)} icon={IndianRupee} accent="ink" />
        <StatCard label="Total orders" value={summary.totalOrders} icon={ShoppingCart} accent="ink" />
        <StatCard label="Pending orders" value={summary.pendingOrders} icon={Clock} accent="amber" />
        <StatCard label="Pending quotes" value={summary.pendingQuotes} icon={FileText} accent="amber" />
        <StatCard label="Active customers" value={summary.activeCustomers} icon={Users} accent="ink" />
        <StatCard label="AMC due in 30 days" value={summary.amcDue} icon={ShieldAlert} accent="brand" />
        <StatCard label="Services scheduled today" value={summary.servicesToday} icon={Wrench} accent="ink" />
        <StatCard label="Low stock products" value={summary.lowStockProducts} icon={PackageX} accent="brand" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="page-heading text-sm text-ink">Revenue, last 30 days</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D8" vertical={false} />
                <XAxis
                  dataKey="_id"
                  tickFormatter={(v) => format(new Date(v), 'd MMM')}
                  tick={{ fontSize: 11, fill: '#4B5563' }}
                  axisLine={{ stroke: '#E4E0D8' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#4B5563' }} axisLine={false} tickLine={false} width={70}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatInr(v)}
                  labelFormatter={(v) => format(new Date(v), 'd MMM yyyy')}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E4E0D8' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#C1272D" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <p className="page-heading text-sm text-ink">Sales by category</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(categoryChart || []).slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="_id" type="category" width={110} tick={{ fontSize: 11, fill: '#1B2027' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatInr(v)} contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E4E0D8' }} />
                <Bar dataKey="revenue" fill="#1B2027" radius={[0, 3, 3, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
