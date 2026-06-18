import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useBilling } from '../context/BillingContext';
import { buildRevenueByPartner, formatCurrencyTick } from '../utils/chartData';

export default function RevenueByPartnerMini() {
  const { bookings, isLoading } = useBilling();
  const revenueByPartner = useMemo(() => buildRevenueByPartner(bookings), [bookings]);

  if (!isLoading && revenueByPartner.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-slate-600">Revenue by Partner</span>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={revenueByPartner} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="partner" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={formatCurrencyTick} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
