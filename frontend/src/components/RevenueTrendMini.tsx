import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useBilling } from '../context/BillingContext';
import { buildRevenueByMonth, formatCurrencyTick } from '../utils/chartData';

export default function RevenueTrendMini() {
  const { bookings, isLoading } = useBilling();
  const revenueByMonth = useMemo(() => buildRevenueByMonth(bookings), [bookings]);

  if (!isLoading && revenueByMonth.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-slate-600">Revenue Trend</span>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueByMonth} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatCurrencyTick} />
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
