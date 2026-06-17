import { useMemo, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { generateInvoice } from '../services/api';
import type { Booking } from '../types';

interface BatchActionsDrawerProps {
  selectedBookings: Booking[];
  onClear: () => void;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function formatCurrency(value: number): string {
  return `S$${value.toFixed(2)}`;
}

export default function BatchActionsDrawer({ selectedBookings, onClear }: BatchActionsDrawerProps) {
  const { refreshData } = useBilling();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const partnerIds = useMemo(
    () => new Set(selectedBookings.map((b) => b.partner_id)),
    [selectedBookings]
  );

  const subtotal = useMemo(
    () => selectedBookings.reduce((sum, b) => sum + Number(b.line_total_sgd), 0),
    [selectedBookings]
  );

  if (selectedBookings.length === 0 && !toast) {
    return null;
  }

  const mixedPartners = partnerIds.size > 1;
  const partnerName = selectedBookings[0]?.partner_name;
  const partnerId = selectedBookings[0]?.partner_id;

  async function handleGenerate() {
    if (mixedPartners || selectedBookings.length === 0) return;

    setIsSubmitting(true);
    setToast(null);
    try {
      const invoice = await generateInvoice(
        String(partnerId),
        selectedBookings.map((b) => b.id)
      );
      onClear();
      await refreshData();
      setToast({
        type: 'success',
        message: `Draft invoice ${invoice.invoice_number} created for ${formatCurrency(Number(invoice.total_sgd))}.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate invoice.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5">
        {toast && (
          <div
            className={`flex items-center justify-between gap-3 rounded-t-xl px-4 py-2 text-sm ${
              toast.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-xs font-medium opacity-60 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {selectedBookings.length > 0 && (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            {mixedPartners ? (
              <p className="text-sm font-medium text-amber-700">
                Invoices must be generated per individual partner. Please filter by partner to batch invoice.
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-700">
                Generate Draft Invoice for <span className="font-semibold">{partnerName}</span> (
                {selectedBookings.length} {selectedBookings.length === 1 ? 'Booking' : 'Bookings'} Selected) — Total:{' '}
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </p>
            )}

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={mixedPartners || isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Generating…' : 'Generate Draft Invoice'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
