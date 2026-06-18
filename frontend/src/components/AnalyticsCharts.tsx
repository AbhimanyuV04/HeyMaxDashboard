import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBilling } from '../context/BillingContext';
import { buildRevenueByMonth, buildRevenueByPartner, buildStatusCounts, formatCurrencyTick } from '../utils/chartData';

const BOOKING_STATUS_COLORS: Record<string, string> = {
  Pending: '#94a3b8',
  Fulfilled: '#3b82f6',
  Cancelled: '#ef4444',
};

const BILLING_STATUS_COLORS: Record<string, string> = {
  Uninvoiced: '#f59e0b',
  Invoiced: '#6366f1',
  Paid: '#10b981',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

export default function AnalyticsCharts() {
  const { bookings, isLoading } = useBilling();

  const revenueByMonth = useMemo(() => buildRevenueByMonth(bookings), [bookings]);
  const revenueByPartner = useMemo(() => buildRevenueByPartner(bookings), [bookings]);
  const bookingStatusCounts = useMemo(() => buildStatusCounts(bookings, 'booking_status'), [bookings]);
  const billingStatusCounts = useMemo(() => buildStatusCounts(bookings, 'billing_status'), [bookings]);

  if (!isLoading && bookings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
        No booking data to chart yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Revenue Over Time">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatCurrencyTick} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Revenue by Partner">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={revenueByPartner}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="partner" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatCurrencyTick} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Bookings by Status">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={bookingStatusCounts} dataKey="count" nameKey="status" outerRadius={80} label>
              {bookingStatusCounts.map((entry) => (
                <Cell key={entry.status} fill={BOOKING_STATUS_COLORS[entry.status] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Bookings by Billing Status">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={billingStatusCounts} dataKey="count" nameKey="status" outerRadius={80} label>
              {billingStatusCounts.map((entry) => (
                <Cell key={entry.status} fill={BILLING_STATUS_COLORS[entry.status] ?? '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
