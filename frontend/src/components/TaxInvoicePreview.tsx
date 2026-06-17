import { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { markInvoiceAsPaid } from '../services/api';
import { PARTNER_ADDRESSES } from '../types';
import type { InvoiceWithPartner } from '../types';

const UNIT_PRICE_SGD = 0.5;

const STATUS_BADGE_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

interface TaxInvoicePreviewProps {
  invoice: InvoiceWithPartner;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function formatCurrency(value: string | number): string {
  return `S$${Number(value).toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-SG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function TaxInvoicePreview({ invoice }: TaxInvoicePreviewProps) {
  const { refreshData } = useBilling();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const subtotal = Number(invoice.subtotal_sgd);
  const quantity = Math.round(subtotal / UNIT_PRICE_SGD);

  async function handleMarkAsPaid() {
    setIsSubmitting(true);
    setToast(null);
    try {
      await markInvoiceAsPaid(invoice.id);
      await refreshData();
      setToast({ type: 'success', message: `Invoice ${invoice.invoice_number} marked as settled` });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to mark invoice as paid',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {invoice.status !== 'Paid' && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Collection action</p>
            <p className="text-xs text-slate-400">Mark this invoice as collected once payment is received.</p>
          </div>
          <button
            type="button"
            onClick={handleMarkAsPaid}
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Processing…' : 'Mark Collection as Paid'}
          </button>
        </div>
      )}

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
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">TAX INVOICE</h2>
              <p className="mt-1 text-sm text-slate-500">Issued under the Singapore GST Act</p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                STATUS_BADGE_STYLES[invoice.status] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              {invoice.status}
            </span>
          </div>

          {/* Provider / Client details */}
          <div className="grid grid-cols-2 gap-8 py-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</h3>
              <p className="mt-2 font-semibold text-slate-800">HeyMax Pte. Ltd.</p>
              <p className="text-sm text-slate-500">160 Robinson Road, #14-04 SBF Center, Singapore 068914</p>
              <p className="mt-1 text-sm text-slate-500">UEN: 202612345M</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill To</h3>
              <p className="mt-2 font-semibold text-slate-800">{invoice.partner_name}</p>
              {invoice.partner_contact_email && (
                <p className="text-sm text-slate-500">{invoice.partner_contact_email}</p>
              )}
              <p className="text-sm text-slate-500">
                {PARTNER_ADDRESSES[invoice.partner_id] ?? 'Address on file'}
              </p>
              {invoice.partner_uen && <p className="mt-1 text-sm text-slate-500">UEN: {invoice.partner_uen}</p>}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice Number</p>
              <p className="mt-1 font-mono font-semibold text-slate-800">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Issue Date</p>
              <p className="mt-1 font-medium text-slate-700">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Due Date</p>
              <p className="mt-1 font-medium text-slate-700">{formatDate(invoice.due_date)}</p>
            </div>
          </div>

          {/* Line items */}
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-700">Affiliate Referral Booking Commission (Fulfilled &amp; Verified)</td>
                <td className="py-3 text-right text-slate-700">{quantity}</td>
                <td className="py-3 text-right text-slate-700">{formatCurrency(UNIT_PRICE_SGD)}</td>
                <td className="py-3 text-right text-slate-700">{formatCurrency(invoice.subtotal_sgd)}</td>
              </tr>
            </tbody>
          </table>

          {/* Financial summary */}
          <div className="mt-6 flex justify-end">
            <table className="w-64 text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-slate-500">Subtotal (SGD)</td>
                  <td className="py-1 text-right font-medium text-slate-700">{formatCurrency(invoice.subtotal_sgd)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-500">Singapore GST (9.00%)</td>
                  <td className="py-1 text-right font-medium text-slate-700">{formatCurrency(invoice.gst_sgd)}</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="py-2 text-base font-semibold text-slate-900">Grand Total (SGD)</td>
                  <td className="py-2 text-right text-base font-semibold text-slate-900">
                    {formatCurrency(invoice.total_sgd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
