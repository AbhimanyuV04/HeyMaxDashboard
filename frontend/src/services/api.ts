import type { Booking, Invoice, InvoiceWithPartner, Metrics } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

export interface BookingFilters {
  partner_id?: string;
  booking_status?: string;
  billing_status?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON; fall back to the status-based message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function getMetrics(): Promise<Metrics> {
  const res = await fetch(`${API_BASE_URL}/metrics`);
  return handleResponse<Metrics>(res);
}

export async function getBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  const params = new URLSearchParams();
  if (filters.partner_id) params.set('partner_id', filters.partner_id);
  if (filters.booking_status) params.set('booking_status', filters.booking_status);
  if (filters.billing_status) params.set('billing_status', filters.billing_status);

  const query = params.toString();
  const res = await fetch(`${API_BASE_URL}/bookings${query ? `?${query}` : ''}`);
  return handleResponse<Booking[]>(res);
}

export async function generateInvoice(partnerId: string, bookingIds: string[]): Promise<Invoice> {
  const res = await fetch(`${API_BASE_URL}/invoices/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partner_id: partnerId, booking_ids: bookingIds }),
  });
  return handleResponse<Invoice>(res);
}

export async function getInvoices(): Promise<InvoiceWithPartner[]> {
  const res = await fetch(`${API_BASE_URL}/invoices`);
  return handleResponse<InvoiceWithPartner[]>(res);
}

export async function markInvoiceAsPaid(id: number): Promise<Invoice> {
  const res = await fetch(`${API_BASE_URL}/invoices/${id}/pay`, {
    method: 'PUT',
  });
  return handleResponse<Invoice>(res);
}

export async function bulkPayInvoices(invoiceIds: number[]): Promise<Invoice[]> {
  const res = await fetch(`${API_BASE_URL}/invoices/bulk-pay`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_ids: invoiceIds }),
  });
  return handleResponse<Invoice[]>(res);
}

export interface BookingUploadResult {
  success: boolean;
  message: string;
  imported: number;
  skipped: { row: number; reason: string }[];
}

export async function uploadBookingsCsv(
  file: File,
  partnerId: string,
  mapping?: Record<string, string>
): Promise<BookingUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('partner_id', partnerId);
  if (mapping && Object.keys(mapping).length > 0) {
    formData.append('mapping', JSON.stringify(mapping));
  }

  const res = await fetch(`${API_BASE_URL}/bookings/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<BookingUploadResult>(res);
}
