import type { Booking } from '../types';

export function formatCurrencyTick(value: number | string | readonly (number | string)[] | undefined): string {
  const numeric = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
  return `S$${numeric.toFixed(2)}`;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-SG', {
    month: 'short',
    year: '2-digit',
  });
}

export function buildRevenueByMonth(bookings: Booking[]) {
  const totals = new Map<string, number>();
  for (const b of bookings) {
    const key = monthKey(b.booking_date);
    totals.set(key, (totals.get(key) ?? 0) + Number(b.line_total_sgd));
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, revenue]) => ({ month: monthLabel(key), revenue: Number(revenue.toFixed(2)) }));
}

export function buildRevenueByPartner(bookings: Booking[]) {
  const totals = new Map<string, number>();
  for (const b of bookings) {
    totals.set(b.partner_name, (totals.get(b.partner_name) ?? 0) + Number(b.line_total_sgd));
  }
  return Array.from(totals.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([partner, revenue]) => ({ partner, revenue: Number(revenue.toFixed(2)) }));
}

export function buildStatusCounts(bookings: Booking[], key: 'booking_status' | 'billing_status') {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    counts.set(b[key], (counts.get(b[key]) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}
