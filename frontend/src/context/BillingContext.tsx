import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getBookings, getInvoices, getMetrics } from '../services/api';
import type { BookingFilters } from '../services/api';
import type { Booking, InvoiceWithPartner, Metrics } from '../types';

interface BillingContextValue {
  metrics: Metrics | null;
  bookings: Booking[];
  invoices: InvoiceWithPartner[];
  isLoading: boolean;
  error: string | null;
  filters: BookingFilters;
  setFilters: (filters: BookingFilters) => void;
  refreshData: () => Promise<void>;
}

const BillingContext = createContext<BillingContextValue | undefined>(undefined);

export function BillingProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BookingFilters>({});

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [metricsData, bookingsData, invoicesData] = await Promise.all([
        getMetrics(),
        getBookings(filters),
        getInvoices(),
      ]);
      setMetrics(metricsData);
      setBookings(bookingsData);
      setInvoices(invoicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <BillingContext.Provider
      value={{ metrics, bookings, invoices, isLoading, error, filters, setFilters, refreshData }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return ctx;
}
