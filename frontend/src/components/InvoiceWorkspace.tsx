import { useMemo, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import type { InvoiceStatus } from '../types';
import TaxInvoicePreview from './TaxInvoicePreview';
import BulkInvoiceActions from './BulkInvoiceActions';

export type InvoiceStatusFilter = 'All' | InvoiceStatus;

const STATUS_TABS: InvoiceStatusFilter[] = ['All', 'Draft', 'Sent', 'Paid'];

const STATUS_BADGE_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Sent: 'bg-indigo-100 text-indigo-700',
  Paid: 'bg-emerald-100 text-emerald-700',
};

function formatCurrency(value: string | number): string {
  return `S$${Number(value).toFixed(2)}`;
}

interface InvoiceWorkspaceProps {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (filter: InvoiceStatusFilter) => void;
}

export default function InvoiceWorkspace({ statusFilter, onStatusFilterChange }: InvoiceWorkspaceProps) {
  const { invoices, isLoading } = useBilling();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const filteredInvoices = useMemo(
    () => (statusFilter === 'All' ? invoices : invoices.filter((inv) => inv.status === statusFilter)),
    [invoices, statusFilter]
  );

  const payableVisible = useMemo(
    () => filteredInvoices.filter((inv) => inv.status !== 'Paid'),
    [filteredInvoices]
  );
  const allPayableSelected = payableVisible.length > 0 && payableVisible.every((inv) => selectedIds.has(inv.id));

  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => selectedIds.has(inv.id)),
    [invoices, selectedIds]
  );

  function toggleInvoice(id: number) {
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

  function toggleSelectAllPayable() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPayableSelected) {
        payableVisible.forEach((inv) => next.delete(inv.id));
      } else {
        payableVisible.forEach((inv) => next.add(inv.id));
      }
      return next;
    });
  }

  function selectSingle(id: number) {
    setSelectedIds(new Set([id]));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Left sidebar: invoice feed */}
      <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:w-96 lg:shrink-0">
        <div className="flex gap-1 border-b border-slate-200 p-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onStatusFilterChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === tab ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              aria-label="Select all eligible invoices"
              checked={allPayableSelected}
              disabled={payableVisible.length === 0}
              onChange={toggleSelectAllPayable}
              className="h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            />
            Select all
          </label>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Clear ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="max-h-[640px] flex-1 divide-y divide-slate-100 overflow-y-auto">
          {filteredInvoices.length === 0 && !isLoading && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No invoices in this category.</p>
          )}
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`flex w-full items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${
                selectedIds.has(invoice.id) ? 'bg-blue-50' : ''
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Select invoice ${invoice.invoice_number}`}
                checked={selectedIds.has(invoice.id)}
                disabled={invoice.status === 'Paid'}
                onChange={() => toggleInvoice(invoice.id)}
                className="mt-1 h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => selectSingle(invoice.id)}
                className="flex flex-1 flex-col gap-1 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-800">{invoice.invoice_number}</span>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[invoice.status]}`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{invoice.partner_name}</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(invoice.total_sgd)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Right preview panel */}
      <section className="min-h-[500px] flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
        {selectedIds.size > 1 ? (
          <BulkInvoiceActions invoices={selectedInvoices} />
        ) : selectedInvoices[0] ? (
          <TaxInvoicePreview invoice={selectedInvoices[0]} />
        ) : (
          <div className="flex h-full min-h-[500px] flex-col items-center justify-center gap-3 text-center text-slate-400">
            <svg
              className="h-16 w-16 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6M9 8h6M5 4.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1.447.894L15 18l-2.553 1.276a1 1 0 0 1-.894 0L9 18l-2.553 1.276A1 1 0 0 1 5 18.382V5.5a1 1 0 0 1 1-1Z"
              />
            </svg>
            <p className="text-lg font-medium text-slate-500">Select an invoice from the list to preview details.</p>
          </div>
        )}
      </section>
    </div>
  );
}
