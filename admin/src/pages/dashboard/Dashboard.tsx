import { useQuery } from '@tanstack/react-query';
import { IndianRupee, ShoppingCart, Users, PackageX, ArrowRight, HardHat, CalendarClock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { StatCard, Card, Spinner } from '../../components/ui/Primitives';
import { PageHeader } from '../../components/layout/PageHeader';
import { DashboardSummary } from '../../types';
import { format, differenceInDays } from 'date-fns';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface DashboardV2Data {
  revenueTrend: { _id: string; revenue: number; orders: number }[];
  jobsByStatus: Record<string, number>;
  amcRenewalsDue: {
    _id: string;
    contractNumber: string;
    endDate: string;
    status: string;
    user?: { name: string; email: string; phone?: string };
    planName?: string;
  }[];
  lowStockItems: {
    _id: string;
    name: string;
    sku: string;
    stock: number;
    price: number;
    category?: { name: string };
  }[];
  technicianUtilisation: {
    id: string;
    name: string;
    phone: string;
    skills: string[];
    currentAssigned: number;
    completedRecent: number;
    maxLoad: number;
    loadPercentage: number;
  }[];
  summary: {
    activeJobsCount: number;
    completedJobsCount: number;
  };
}

const JOB_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  requested: { bg: 'bg-amber-100 text-amber-800', text: 'text-amber-800', label: 'Requested' },
  confirmed: { bg: 'bg-blue-100 text-blue-800', text: 'text-blue-800', label: 'Confirmed' },
  assigned: { bg: 'bg-indigo-100 text-indigo-800', text: 'text-indigo-800', label: 'Assigned' },
  technician_on_the_way: { bg: 'bg-purple-100 text-purple-800', text: 'text-purple-800', label: 'On The Way' },
  in_progress: { bg: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-800', label: 'In Progress' },
  completed: { bg: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-800', label: 'Completed' },
  cancelled: { bg: 'bg-rose-100 text-rose-800', text: 'text-rose-800', label: 'Cancelled' }
};

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get('/reports/dashboard')).data.data as DashboardSummary
  });

  const { data: v2Data, isLoading: isV2Loading } = useQuery({
    queryKey: ['dashboard-v2'],
    queryFn: async () => (await api.get('/reports/dashboard-v2')).data.data as DashboardV2Data
  });

  const { data: categoryChart } = useQuery({
    queryKey: ['sales-by-category'],
    queryFn: async () => (await api.get('/reports/sales-by-category')).data.data as { _id: string; revenue: number }[]
  });

  if (isSummaryLoading || isV2Loading || !summary || !v2Data) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard v2"
        description="Live operational command center: revenue trend, job progress, AMC renewals, stock levels, and field technician utilisation."
      />

      {/* Top Stat KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatInr(summary.totalRevenue)} icon={IndianRupee} accent="forest" />
        <StatCard label="Monthly Revenue" value={formatInr(summary.monthlyRevenue)} icon={IndianRupee} accent="ink" />
        <StatCard label="Total Orders" value={summary.totalOrders} icon={ShoppingCart} accent="ink" />
        <StatCard label="Active Customers" value={summary.activeCustomers} icon={Users} accent="ink" />
      </div>

      {/* Primary Visualizations: 30-Day Revenue Trend & Category Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="page-heading text-sm text-ink font-semibold">30-Day Revenue Trend</p>
              <p className="text-xs text-slateink">Daily gross sales volume and trend line</p>
            </div>
            <span className="rounded bg-paper px-2.5 py-1 text-xs font-medium text-slateink border border-line">
              Trailing 30 Days
            </span>
          </div>

          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={v2Data.revenueTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D8" vertical={false} />
                <XAxis
                  dataKey="_id"
                  tickFormatter={(v) => format(new Date(v), 'd MMM')}
                  tick={{ fontSize: 11, fill: '#4B5563' }}
                  axisLine={{ stroke: '#E4E0D8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#4B5563' }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [formatInr(v), 'Revenue']}
                  labelFormatter={(v) => format(new Date(v), 'd MMM yyyy')}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E0D8' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#C1272D"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#C1272D' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <p className="page-heading text-sm font-semibold text-ink">Sales by Category</p>
          <p className="text-xs text-slateink">Top performing product lines</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(categoryChart || []).slice(0, 6)} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="_id"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11, fill: '#1B2027' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => formatInr(v)}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E4E0D8' }}
                />
                <Bar dataKey="revenue" fill="#1B2027" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Feature Section 1: Jobs by Status Breakdown */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="page-heading text-sm font-semibold text-ink">Field Service Jobs by Status</p>
            <p className="text-xs text-slateink">Current breakdown of customer service dispatches</p>
          </div>
          <button
            onClick={() => navigate('/services')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Manage Bookings <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(v2Data.jobsByStatus).map(([statusKey, count]) => {
            const style = JOB_STATUS_COLORS[statusKey] || { bg: 'bg-paper text-ink', text: 'text-ink', label: statusKey };
            return (
              <div
                key={statusKey}
                onClick={() => navigate(`/services?status=${statusKey}`)}
                className="cursor-pointer rounded-lg border border-line bg-paper/40 p-3 hover:bg-paper transition-colors"
              >
                <p className="text-[11px] font-medium text-slateink capitalize">{style.label}</p>
                <p className="stat-number mt-1 text-2xl font-bold text-ink">{count}</p>
                <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${style.bg}`}>
                  {count > 0 ? `${count} Active` : 'None'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Feature Section 2: AMC Renewals Due in 30 Days & Low Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AMC Renewals Due */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand" />
              <div>
                <p className="page-heading text-sm font-semibold text-ink">AMC Renewals Due in 30 Days</p>
                <p className="text-xs text-slateink">Contracts expiring soon requiring renewal outreach</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/amc')}
              className="text-xs font-semibold text-brand hover:underline"
            >
              View All ({v2Data.amcRenewalsDue.length})
            </button>
          </div>

          <div className="mt-3 divide-y divide-line">
            {v2Data.amcRenewalsDue.length === 0 ? (
              <p className="py-6 text-center text-xs text-slateink">No contracts expiring in the next 30 days.</p>
            ) : (
              v2Data.amcRenewalsDue.map((contract) => {
                const daysLeft = differenceInDays(new Date(contract.endDate), new Date());
                return (
                  <div key={contract._id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-xs font-semibold text-ink">{contract.contractNumber}</p>
                      <p className="text-[11px] text-slateink">
                        {contract.user?.name || 'Customer'} · {contract.planName || 'Annual Plan'}
                      </p>
                      {contract.user?.phone && (
                        <p className="text-[10px] text-slateink/80">{contract.user.phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        daysLeft <= 7 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {daysLeft <= 0 ? 'Expires today' : `${daysLeft} days left`}
                      </span>
                      <p className="mt-1 text-[10px] text-slateink">
                        Ends {format(new Date(contract.endDate), 'd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Low Stock Alert */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <PackageX className="h-4 w-4 text-brand" />
              <div>
                <p className="page-heading text-sm font-semibold text-ink">Low Stock Inventory Alert</p>
                <p className="text-xs text-slateink">Units at or below safety reorder threshold (≤ 5)</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/products?lowStock=true')}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Manage Products
            </button>
          </div>

          <div className="mt-3 divide-y divide-line">
            {v2Data.lowStockItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-forest font-medium">All equipment inventory healthy.</p>
            ) : (
              v2Data.lowStockItems.map((prod) => (
                <div key={prod._id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-xs font-semibold text-ink">{prod.name}</p>
                    <p className="text-[11px] text-slateink">SKU: {prod.sku} · {prod.category?.name || 'General'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      prod.stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {prod.stock === 0 ? 'Out of stock' : `${prod.stock} left`}
                    </span>
                    <p className="mt-0.5 text-[11px] font-medium text-ink">₹{prod.price.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Feature Section 3: Technician Utilisation & Field Capacity */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-forest" />
            <div>
              <p className="page-heading text-sm font-semibold text-ink">Technician Utilisation & Workload</p>
              <p className="text-xs text-slateink">Live field load balance across certified service engineers</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/technicians')}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Manage Technicians
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {v2Data.technicianUtilisation.length === 0 ? (
            <p className="py-6 text-center text-xs text-slateink col-span-3">No active technicians registered.</p>
          ) : (
            v2Data.technicianUtilisation.map((tech) => (
              <div key={tech.id} className="rounded-lg border border-line bg-paper/40 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-ink">{tech.name}</p>
                    <p className="text-[11px] text-slateink">{tech.phone}</p>
                    <p className="mt-1 text-[10px] text-slateink">
                      {tech.skills?.join(', ') || 'Fire Safety Technician'}
                    </p>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    tech.loadPercentage >= 80 ? 'bg-rose-100 text-rose-700' :
                    tech.loadPercentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {tech.loadPercentage}% Load
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        tech.loadPercentage >= 80 ? 'bg-rose-600' :
                        tech.loadPercentage >= 50 ? 'bg-amber-500' : 'bg-forest'
                      }`}
                      style={{ width: `${Math.min(100, tech.loadPercentage)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slateink">
                    <span>{tech.currentAssigned} Active Jobs</span>
                    <span>{tech.completedRecent} Completed this month</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
