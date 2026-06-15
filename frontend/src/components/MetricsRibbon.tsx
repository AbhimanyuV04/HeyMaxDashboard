import { useBilling } from '../context/BillingContext';

type Accent = 'neutral' | 'action' | 'success';

interface MetricCardProps {
  label: string;
  value: number | undefined;
  description: string;
  accent: Accent;
  isLoading: boolean;
  onClick?: () => void;
}

const ACCENT_STYLES: Record<Accent, string> = {
  neutral: 'border-slate-200 bg-white text-slate-900',
  action: 'border-amber-300 bg-amber-50 text-amber-900',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

function formatCurrency(value: number | undefined): string {
  if (value === undefined) return 'S$0.00';
  return `S$${value.toFixed(2)}`;
}

function MetricCard({ label, value, description, accent, isLoading, onClick }: MetricCardProps) {
  const interactive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`relative overflow-hidden rounded-xl border p-5 shadow-sm transition ${ACCENT_STYLES[accent]} ${
        interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400' : ''
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium uppercase tracking-wide opacity-70">{label}</span>
        {isLoading ? (
          <div className="h-9 w-32 animate-pulse rounded bg-slate-300/40" />
        ) : (
          <span className="text-3xl font-semibold">{formatCurrency(value)}</span>
        )}
        <span className="text-sm opacity-60">{description}</span>
      </div>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-white/30" />}
    </div>
  );
}

interface MetricsRibbonProps {
  onReadyToInvoiceClick?: () => void;
  onTotalCollectedClick?: () => void;
}

export default function MetricsRibbon({ onReadyToInvoiceClick, onTotalCollectedClick }: MetricsRibbonProps) {
  const { metrics, isLoading } = useBilling();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard
        label="Accrued Pipeline"
        value={metrics?.total_accrued_pipeline}
        description="Tracked, not yet invoiced"
        accent="neutral"
        isLoading={isLoading}
      />
      <MetricCard
        label="Ready to Invoice"
        value={metrics?.ready_to_invoice}
        description="Stayed & uninvoiced — action required"
        accent="action"
        isLoading={isLoading}
        onClick={onReadyToInvoiceClick}
      />
      <MetricCard
        label="Total Collected"
        value={metrics?.total_collected}
        description="Paid invoices to date"
        accent="success"
        isLoading={isLoading}
        onClick={onTotalCollectedClick}
      />
    </div>
  );
}
