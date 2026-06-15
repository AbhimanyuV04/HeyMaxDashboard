import { useState } from 'react';
import MetricsRibbon from './components/MetricsRibbon';
import BookingLedgerTable from './components/BookingLedgerTable';
import InvoiceWorkspace from './components/InvoiceWorkspace';
import type { InvoiceStatusFilter } from './components/InvoiceWorkspace';
import { useBilling } from './context/BillingContext';

type View = 'bookings' | 'invoices';

const NAV_TABS: { id: View; label: string }[] = [
  { id: 'bookings', label: 'Bookings Ledger' },
  { id: 'invoices', label: 'Invoices Hub' },
];

function App() {
  const { error, filters, setFilters } = useBilling();
  const [view, setView] = useState<View>('bookings');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('All');

  function handleReadyToInvoiceClick() {
    setView('bookings');
    setFilters({ ...filters, booking_status: 'Stayed', billing_status: 'Uninvoiced' });
  }

  function handleTotalCollectedClick() {
    setView('invoices');
    setInvoiceStatusFilter('Paid');
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-2xl font-semibold text-slate-900">HeyMax Billing &amp; Reconciliation</h1>
          <p className="text-sm text-slate-500">Partner booking ledger and invoicing dashboard</p>
          <nav className="mt-4 flex gap-2">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <MetricsRibbon
          onReadyToInvoiceClick={handleReadyToInvoiceClick}
          onTotalCollectedClick={handleTotalCollectedClick}
        />
        {view === 'bookings' ? (
          <BookingLedgerTable />
        ) : (
          <InvoiceWorkspace statusFilter={invoiceStatusFilter} onStatusFilterChange={setInvoiceStatusFilter} />
        )}
      </main>
    </div>
  );
}

export default App;
