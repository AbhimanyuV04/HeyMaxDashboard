import { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { bulkPayInvoices } from '../services/api';
import type { InvoiceWithPartner } from '../types';

const STATUS_BADGE_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

interface BulkInvoiceActionsProps {
  invoices: InvoiceWithPartner[];
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function formatCurrency(value: string | number): string {
  return `S$${Number(value).toFixed(2)}`;
}

export default function BulkInvoiceActions({ invoices }: BulkInvoiceActionsProps) {
  const { refreshData } = useBilling();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const payableInvoices = invoices.filter((inv) => inv.status !== 'Paid');
  const combinedTotal = payableInvoices.reduce((sum, inv) => sum + Number(inv.total_sgd), 0);

  async function handleBulkPay() {
    setIsSubmitting(true);
    setToast(null);
    try {
      await bulkPayInvoices(payableInvoices.map((inv) => inv.id));
      await refreshData();
      setToast({
        type: 'success',
        message: `${payableInvoices.length} invoice${payableInvoices.length === 1 ? '' : 's'} marked as settled`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to mark invoices as paid',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Bulk collection action</p>
          <p className="text-xs text-slate-400">
            {payableInvoices.length} of {invoices.length} selected invoices are eligible for settlement.
          </p>
        </div>
        <button
          type="button"
          onClick={handleBulkPay}
          disabled={isSubmitting || payableInvoices.length === 0}
          className="shrink-0 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? 'Processing…'
            : `Mark ${payableInvoices.length} Invoice${payableInvoices.length === 1 ? '' : 's'} as Paid`}
        </button>
      </div>

      {toast && (
        <div
          className={`flex items-center justify-between gap-3 px-6 py-2 text-sm ${
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

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bulk Collection Summary</h2>
          <p className="mt-1 text-sm text-slate-500">Review the selected invoices before confirming settlement.</p>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected Invoices</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{invoices.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Combined Total (SGD)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{formatCurrency(combinedTotal)}</p>
            </div>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2">Invoice</th>
                <th className="py-2">Partner</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Total (SGD)</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100">
                  <td className="py-3 font-mono text-slate-700">{inv.invoice_number}</td>
                  <td className="py-3 text-slate-700">{inv.partner_name}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE_STYLES[inv.status] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-700">{formatCurrency(inv.total_sgd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
