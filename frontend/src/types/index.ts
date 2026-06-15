export type BookingStatus = 'Pending' | 'Stayed' | 'Cancelled';
export type BillingStatus = 'Uninvoiced' | 'Invoiced' | 'Paid';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid';

export interface Booking {
  id: string;
  partner_id: number;
  booking_date: string;
  check_in_date: string;
  check_out_date: string;
  quantity: number;
  rate_sgd: string;
  line_total_sgd: string;
  booking_status: BookingStatus;
  billing_status: BillingStatus;
  invoice_id: number | null;
  created_at: string;
  partner_name: string;
}

export interface Metrics {
  total_accrued_pipeline: number;
  ready_to_invoice: number;
  total_collected: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  partner_id: number;
  issue_date: string;
  due_date: string;
  subtotal_sgd: string;
  gst_sgd: string;
  total_sgd: string;
  status: InvoiceStatus;
  created_at: string;
}

export interface InvoiceWithPartner extends Invoice {
  partner_name: string;
  partner_contact_email: string | null;
  partner_uen: string | null;
}

export interface Partner {
  id: string;
  name: string;
}

// Static partner directory matching the seeded partners table (Phase 1).
export const PARTNERS: Partner[] = [
  { id: '1', name: 'Agoda' },
  { id: '2', name: 'Booking.com' },
  { id: '3', name: 'Expedia' },
];

// Mock corporate addresses for the Tax Invoice preview (not stored in the DB schema).
export const PARTNER_ADDRESSES: Record<number, string> = {
  1: '10 Pasir Panjang Road, #10-01 Mapletree Business City, Singapore 117438',
  2: '5 Temasek Boulevard, #12-01 Suntec Tower 5, Singapore 038985',
  3: '1 Raffles Quay, #20-02 North Tower, Singapore 048583',
};
