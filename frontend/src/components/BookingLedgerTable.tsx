import { useMemo, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { PARTNERS } from '../types';
import type { Booking } from '../types';
import BatchActionsDrawer from './BatchActionsDrawer';
import CSVUploadZone from './CSVUploadZone';

const BOOKING_STATUS_OPTIONS = ['Fulfilled', 'Pending', 'Cancelled'] as const;
const BILLING_STATUS_OPTIONS = ['Uninvoiced', 'Invoiced', 'Paid'] as const;

const BOOKING_STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-700',
  Fulfilled: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-red-100 text-red-700',
};

const BILLING_STATUS_STYLES: Record<string, string> = {
  Uninvoiced: 'bg-amber-100 text-amber-800',
  Invoiced: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

function isEligible(booking: Booking): boolean {
  return booking.booking_status === 'Fulfilled' && booking.billing_status === 'Uninvoiced';
}

function formatCurrency(value: string | number): string {
  return `S$${Number(value).toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

export default function BookingLedgerTable() {
  const { bookings, isLoading, filters, setFilters } = useBilling();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const eligibleBookings = useMemo(() => bookings.filter(isEligible), [bookings]);
  const eligibleIds = useMemo(() => new Set(eligibleBookings.map((b) => b.id)), [eligibleBookings]);
  const allEligibleSelected =
    eligibleBookings.length > 0 && eligibleBookings.every((b) => selectedIds.has(b.id));

  const selectedBookings = useMemo(
    () => bookings.filter((b) => selectedIds.has(b.id)),
    [bookings, selectedIds]
  );

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllEligible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allEligibleSelected) {
        eligibleBookings.forEach((b) => next.delete(b.id));
      } else {
        eligibleBookings.forEach((b) => next.add(b.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <CSVUploadZone />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Partner
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filters.partner_id ?? ''}
            onChange={(e) => setFilters({ ...filters, partner_id: e.target.value || undefined })}
          >
            <option value="">All</option>
            {PARTNERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Booking Status
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filters.booking_status ?? ''}
            onChange={(e) => setFilters({ ...filters, booking_status: e.target.value || undefined })}
          >
            <option value="">All</option>
            {BOOKING_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Billing Status
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={filters.billing_status ?? ''}
            onChange={(e) => setFilters({ ...filters, billing_status: e.target.value || undefined })}
          >
            <option value="">All</option>
            {BILLING_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        {isLoading && <span className="text-sm text-slate-400">Refreshing…</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all eligible bookings"
                  checked={allEligibleSelected}
                  disabled={eligibleBookings.length === 0}
                  onChange={toggleSelectAllEligible}
                  className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Partner</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking Date</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Check-out Date</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount (SGD)</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Booking Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Billing Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No bookings match the current filters.
                </td>
              </tr>
            )}
            {bookings.map((booking) => {
              const eligible = eligibleIds.has(booking.id);
              return (
                <tr key={booking.id} className={selectedIds.has(booking.id) ? 'bg-blue-50' : undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select booking ${booking.id}`}
                      checked={selectedIds.has(booking.id)}
                      disabled={!eligible}
                      onChange={() => toggleRow(booking.id)}
                      className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{booking.id}</td>
                  <td className="px-4 py-3 text-slate-700">{booking.partner_name}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(booking.booking_date)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(booking.check_out_date)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(booking.line_total_sgd)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.booking_status} styles={BOOKING_STATUS_STYLES} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.billing_status} styles={BILLING_STATUS_STYLES} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BatchActionsDrawer selectedBookings={selectedBookings} onClear={clearSelection} />
    </div>
  );
}
