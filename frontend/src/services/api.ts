import * as XLSX from 'xlsx';
import type { Booking, Invoice, InvoiceWithPartner, Metrics } from '../types';

export interface BookingFilters {
  partner_id?: string;
  booking_status?: string;
  billing_status?: string;
}

const STORAGE_KEYS = {
  BOOKINGS: 'heymax_bookings',
  INVOICES: 'heymax_invoices',
} as const;

const GST_RATE = 0.09;
const RATE_SGD = 0.5;

const PARTNER_META: Record<number, { name: string; contact_email: string; uen: string }> = {
  1: { name: 'Agoda', contact_email: 'finance@agoda.com', uen: '201001234A' },
  2: { name: 'Booking.com', contact_email: 'billing@booking.com', uen: '201198765B' },
  3: { name: 'Expedia', contact_email: 'ap@expedia.com', uen: '201245678C' },
  4: { name: 'Trip.com', contact_email: 'finance@trip.com', uen: '201301234D' },
};

const PREFIX_MAP: Record<number, string> = { 1: 'AGD', 2: 'BDC', 3: 'EXP', 4: 'TRP' };

const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 400));

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function makeBooking(
  id: string,
  partnerId: number,
  bookingStatus: Booking['booking_status'],
  billingStatus: Booking['billing_status'],
  quantity: number,
  checkInOffset: number,
  checkOutOffset: number,
  invoiceId: number | null = null
): Booking {
  return {
    id,
    partner_id: partnerId,
    booking_date: offsetDate(checkInOffset - 7),
    check_in_date: offsetDate(checkInOffset),
    check_out_date: offsetDate(checkOutOffset),
    quantity,
    rate_sgd: RATE_SGD.toFixed(2),
    line_total_sgd: (quantity * RATE_SGD).toFixed(2),
    booking_status: bookingStatus,
    billing_status: billingStatus,
    invoice_id: invoiceId,
    created_at: new Date().toISOString(),
    partner_name: PARTNER_META[partnerId].name,
  };
}

function makeInvoice(
  id: number,
  number: string,
  partnerId: number,
  subtotal: number,
  status: 'Sent' | 'Paid',
  issueDateOffset: number
): InvoiceWithPartner {
  const gst = parseFloat((subtotal * GST_RATE).toFixed(2));
  const total = parseFloat((subtotal + gst).toFixed(2));
  const meta = PARTNER_META[partnerId];
  return {
    id,
    invoice_number: number,
    partner_id: partnerId,
    issue_date: offsetDate(issueDateOffset),
    due_date: offsetDate(issueDateOffset + 30),
    subtotal_sgd: subtotal.toFixed(2),
    gst_sgd: gst.toFixed(2),
    total_sgd: total.toFixed(2),
    status,
    created_at: new Date().toISOString(),
    partner_name: meta.name,
    partner_contact_email: meta.contact_email,
    partner_uen: meta.uen,
  };
}

function createSeedData(): { bookings: Booking[]; invoices: InvoiceWithPartner[] } {
  const bookings: Booking[] = [
    // Agoda — 7 fulfilled, 4 pending, 2 cancelled
    makeBooking('AGD-100001', 1, 'Fulfilled', 'Uninvoiced', 2, -6, -5),
    makeBooking('AGD-100002', 1, 'Fulfilled', 'Uninvoiced', 1, -11, -10),
    makeBooking('AGD-100003', 1, 'Fulfilled', 'Uninvoiced', 3, -16, -15),
    makeBooking('AGD-100004', 1, 'Fulfilled', 'Invoiced',   2, -21, -20, 1),
    makeBooking('AGD-100005', 1, 'Fulfilled', 'Invoiced',   1, -26, -25, 1),
    makeBooking('AGD-100006', 1, 'Fulfilled', 'Paid',       2, -61, -60, 4),
    makeBooking('AGD-100007', 1, 'Fulfilled', 'Paid',       3, -66, -65, 4),
    makeBooking('AGD-100008', 1, 'Pending', 'Uninvoiced', 2,  5,  6),
    makeBooking('AGD-100009', 1, 'Pending', 'Uninvoiced', 1, 10, 11),
    makeBooking('AGD-100010', 1, 'Pending', 'Uninvoiced', 2, 20, 21),
    makeBooking('AGD-100011', 1, 'Pending', 'Uninvoiced', 1, 30, 31),
    makeBooking('AGD-100012', 1, 'Cancelled', 'Uninvoiced', 2, -31, -30),
    makeBooking('AGD-100013', 1, 'Cancelled', 'Uninvoiced', 1, -46, -45),
    // Booking.com
    makeBooking('BDC-100001', 2, 'Fulfilled', 'Uninvoiced', 2,  -8,  -7),
    makeBooking('BDC-100002', 2, 'Fulfilled', 'Uninvoiced', 1, -13, -12),
    makeBooking('BDC-100003', 2, 'Fulfilled', 'Uninvoiced', 3, -19, -18),
    makeBooking('BDC-100004', 2, 'Fulfilled', 'Invoiced',   2, -23, -22, 2),
    makeBooking('BDC-100005', 2, 'Fulfilled', 'Invoiced',   2, -29, -28, 2),
    makeBooking('BDC-100006', 2, 'Fulfilled', 'Paid',       1, -56, -55, 5),
    makeBooking('BDC-100007', 2, 'Fulfilled', 'Paid',       4, -71, -70, 5),
    makeBooking('BDC-100008', 2, 'Pending', 'Uninvoiced', 2,  3,  5),
    makeBooking('BDC-100009', 2, 'Pending', 'Uninvoiced', 1,  8, 10),
    makeBooking('BDC-100010', 2, 'Pending', 'Uninvoiced', 3, 15, 17),
    makeBooking('BDC-100011', 2, 'Pending', 'Uninvoiced', 1, 25, 27),
    makeBooking('BDC-100012', 2, 'Cancelled', 'Uninvoiced', 2, -36, -35),
    makeBooking('BDC-100013', 2, 'Cancelled', 'Uninvoiced', 1, -51, -50),
    // Expedia
    makeBooking('EXP-100001', 3, 'Fulfilled', 'Uninvoiced', 3,  -7,  -6),
    makeBooking('EXP-100002', 3, 'Fulfilled', 'Uninvoiced', 2, -15, -14),
    makeBooking('EXP-100003', 3, 'Fulfilled', 'Uninvoiced', 1, -18, -17),
    makeBooking('EXP-100004', 3, 'Fulfilled', 'Invoiced',   3, -24, -23, 3),
    makeBooking('EXP-100005', 3, 'Fulfilled', 'Invoiced',   1, -28, -27, 3),
    makeBooking('EXP-100006', 3, 'Fulfilled', 'Paid',       2, -59, -58, 6),
    makeBooking('EXP-100007', 3, 'Fulfilled', 'Paid',       2, -63, -62, 6),
    makeBooking('EXP-100008', 3, 'Pending', 'Uninvoiced', 1,  4,  6),
    makeBooking('EXP-100009', 3, 'Pending', 'Uninvoiced', 2, 12, 14),
    makeBooking('EXP-100010', 3, 'Pending', 'Uninvoiced', 3, 18, 20),
    makeBooking('EXP-100011', 3, 'Pending', 'Uninvoiced', 1, 28, 30),
    makeBooking('EXP-100012', 3, 'Cancelled', 'Uninvoiced', 3, -41, -40),
    makeBooking('EXP-100013', 3, 'Cancelled', 'Uninvoiced', 2, -49, -48),
    // Trip.com
    makeBooking('TRP-100001', 4, 'Fulfilled', 'Uninvoiced', 2,  -7,  -6),
    makeBooking('TRP-100002', 4, 'Fulfilled', 'Uninvoiced', 1, -12, -11),
    makeBooking('TRP-100003', 4, 'Fulfilled', 'Uninvoiced', 3, -17, -16),
    makeBooking('TRP-100004', 4, 'Fulfilled', 'Invoiced',   2, -22, -21, 7),
    makeBooking('TRP-100005', 4, 'Fulfilled', 'Invoiced',   1, -27, -26, 7),
    makeBooking('TRP-100006', 4, 'Fulfilled', 'Paid',       2, -62, -61, 8),
    makeBooking('TRP-100007', 4, 'Fulfilled', 'Paid',       3, -67, -66, 8),
    makeBooking('TRP-100008', 4, 'Pending', 'Uninvoiced', 2,  6,  7),
    makeBooking('TRP-100009', 4, 'Pending', 'Uninvoiced', 1, 11, 12),
    makeBooking('TRP-100010', 4, 'Pending', 'Uninvoiced', 2, 21, 22),
    makeBooking('TRP-100011', 4, 'Pending', 'Uninvoiced', 1, 31, 32),
    makeBooking('TRP-100012', 4, 'Cancelled', 'Uninvoiced', 2, -32, -31),
    makeBooking('TRP-100013', 4, 'Cancelled', 'Uninvoiced', 1, -47, -46),
  ];

  // Invoices: 1-3 Sent, 4-6 Paid, 7-8 Trip.com (Sent, Paid)
  // Invoice 1: Agoda Sent — AGD-100004 (qty:2→1.00) + AGD-100005 (qty:1→0.50) = subtotal 1.50
  // Invoice 2: BDC Sent   — BDC-100004 (qty:2→1.00) + BDC-100005 (qty:2→1.00) = subtotal 2.00
  // Invoice 3: EXP Sent   — EXP-100004 (qty:3→1.50) + EXP-100005 (qty:1→0.50) = subtotal 2.00
  // Invoice 4: Agoda Paid — AGD-100006 (qty:2→1.00) + AGD-100007 (qty:3→1.50) = subtotal 2.50
  // Invoice 5: BDC Paid   — BDC-100006 (qty:1→0.50) + BDC-100007 (qty:4→2.00) = subtotal 2.50
  // Invoice 6: EXP Paid   — EXP-100006 (qty:2→1.00) + EXP-100007 (qty:2→1.00) = subtotal 2.00
  // Invoice 7: TRP Sent   — TRP-100004 (qty:2→1.00) + TRP-100005 (qty:1→0.50) = subtotal 1.50
  // Invoice 8: TRP Paid   — TRP-100006 (qty:2→1.00) + TRP-100007 (qty:3→1.50) = subtotal 2.50
  const invoices: InvoiceWithPartner[] = [
    makeInvoice(1, 'HMAX-2026-001', 1, 1.50, 'Sent', -20),
    makeInvoice(2, 'HMAX-2026-002', 2, 2.00, 'Sent', -22),
    makeInvoice(3, 'HMAX-2026-003', 3, 2.00, 'Sent', -23),
    makeInvoice(4, 'HMAX-2026-004', 1, 2.50, 'Paid', -55),
    makeInvoice(5, 'HMAX-2026-005', 2, 2.50, 'Paid', -60),
    makeInvoice(6, 'HMAX-2026-006', 3, 2.00, 'Paid', -62),
    makeInvoice(7, 'HMAX-2026-007', 4, 1.50, 'Sent', -21),
    makeInvoice(8, 'HMAX-2026-008', 4, 2.50, 'Paid', -61),
  ];

  return { bookings, invoices };
}

export function initLocalStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS) || !localStorage.getItem(STORAGE_KEYS.INVOICES)) {
    const { bookings, invoices } = createSeedData();
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }
}

function readBookings(): Booking[] {
  initLocalStorage();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS)!) as Booking[];
}

function writeBookings(bookings: Booking[]): void {
  localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
}

function readInvoices(): InvoiceWithPartner[] {
  initLocalStorage();
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.INVOICES)!) as InvoiceWithPartner[];
}

function writeInvoices(invoices: InvoiceWithPartner[]): void {
  localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
}

function nextInvoiceNumber(invoices: InvoiceWithPartner[]): string {
  const year = new Date().getFullYear();
  const max = invoices.reduce((m, inv) => {
    const match = inv.invoice_number.match(/HMAX-\d{4}-(\d+)/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `HMAX-${year}-${String(max + 1).padStart(3, '0')}`;
}

// ── Public API functions ──────────────────────────────────────────────────────

export async function getMetrics(): Promise<Metrics> {
  await delay();
  const bookings = readBookings();
  const invoices = readInvoices();

  const total_accrued_pipeline = bookings
    .filter((b) => b.booking_status === 'Fulfilled')
    .reduce((sum, b) => sum + Number(b.line_total_sgd), 0);

  const ready_to_invoice = bookings
    .filter((b) => b.booking_status === 'Fulfilled' && b.billing_status === 'Uninvoiced')
    .reduce((sum, b) => sum + Number(b.line_total_sgd), 0);

  const total_collected = invoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((sum, inv) => sum + Number(inv.total_sgd), 0);

  return { total_accrued_pipeline, ready_to_invoice, total_collected };
}

export async function getBookings(filters: BookingFilters = {}): Promise<Booking[]> {
  await delay();
  let bookings = readBookings();
  if (filters.partner_id) bookings = bookings.filter((b) => String(b.partner_id) === filters.partner_id);
  if (filters.booking_status) bookings = bookings.filter((b) => b.booking_status === filters.booking_status);
  if (filters.billing_status) bookings = bookings.filter((b) => b.billing_status === filters.billing_status);
  return bookings;
}

export async function generateInvoice(partnerId: string, bookingIds: string[]): Promise<Invoice> {
  await delay();
  const bookings = readBookings();
  const invoices = readInvoices();

  const selected = bookings.filter(
    (b) => bookingIds.includes(b.id) && String(b.partner_id) === partnerId
  );
  if (selected.length === 0) throw new Error('No eligible bookings found for this partner.');

  const subtotal = selected.reduce((sum, b) => sum + Number(b.line_total_sgd), 0);
  const gst = parseFloat((subtotal * GST_RATE).toFixed(2));
  const total = parseFloat((subtotal + gst).toFixed(2));
  const today = new Date().toISOString().split('T')[0];
  const dueDate = offsetDate(30);
  const newId = invoices.reduce((m, inv) => Math.max(m, inv.id), 0) + 1;
  const meta = PARTNER_META[Number(partnerId)];

  const newInvoice: InvoiceWithPartner = {
    id: newId,
    invoice_number: nextInvoiceNumber(invoices),
    partner_id: Number(partnerId),
    issue_date: today,
    due_date: dueDate,
    subtotal_sgd: subtotal.toFixed(2),
    gst_sgd: gst.toFixed(2),
    total_sgd: total.toFixed(2),
    status: 'Draft',
    created_at: new Date().toISOString(),
    partner_name: meta.name,
    partner_contact_email: meta.contact_email,
    partner_uen: meta.uen,
  };

  writeInvoices([newInvoice, ...invoices]);
  writeBookings(
    bookings.map((b) =>
      bookingIds.includes(b.id) && String(b.partner_id) === partnerId
        ? { ...b, billing_status: 'Invoiced' as const, invoice_id: newId }
        : b
    )
  );

  return newInvoice;
}

export async function getInvoices(): Promise<InvoiceWithPartner[]> {
  await delay();
  return readInvoices();
}

export async function markInvoiceAsPaid(id: number): Promise<Invoice> {
  await delay();
  const invoices = readInvoices();
  const updated = invoices.map((inv) =>
    inv.id === id ? { ...inv, status: 'Paid' as const } : inv
  );
  writeInvoices(updated);
  writeBookings(
    readBookings().map((b) =>
      b.invoice_id === id ? { ...b, billing_status: 'Paid' as const } : b
    )
  );
  return updated.find((inv) => inv.id === id)!;
}

export async function bulkPayInvoices(invoiceIds: number[]): Promise<Invoice[]> {
  await delay();
  const invoices = readInvoices();
  const updated = invoices.map((inv) =>
    invoiceIds.includes(inv.id) ? { ...inv, status: 'Paid' as const } : inv
  );
  writeInvoices(updated);
  writeBookings(
    readBookings().map((b) =>
      b.invoice_id !== null && invoiceIds.includes(b.invoice_id)
        ? { ...b, billing_status: 'Paid' as const }
        : b
    )
  );
  return updated.filter((inv) => invoiceIds.includes(inv.id));
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
  await delay();

  const partnerIdNum = Number(partnerId);
  const meta = PARTNER_META[partnerIdNum];
  if (!meta) throw new Error('Invalid partner selected.');

  // Parse the file entirely client-side via XLSX
  let rows: Record<string, unknown>[];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false, defval: '' });
  } catch {
    throw new Error('Could not parse the uploaded file. Please check the format and try again.');
  }

  const existingBookings = readBookings();
  const existingIds = new Set(existingBookings.map((b) => b.id));

  const prefix = PREFIX_MAP[partnerIdNum] ?? 'UPL';
  const maxExistingSeq = existingBookings
    .filter((b) => b.partner_id === partnerIdNum)
    .reduce((m, b) => {
      const tail = parseInt(b.id.split('-').pop() ?? '0', 10);
      return Math.max(m, isNaN(tail) ? 0 : tail);
    }, 100000);
  let nextSeq = maxExistingSeq + 1;

  const skipped: { row: number; reason: string }[] = [];
  const imported: Booking[] = [];

  const getField = (row: Record<string, unknown>, key: string): string => {
    const col = mapping?.[key];
    return col ? String(row[col] ?? '').trim() : '';
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const bookingId = getField(row, 'booking_id') || `${prefix}-${nextSeq}`;
    const checkIn = getField(row, 'check_in_date');
    const checkOut = getField(row, 'check_out_date');

    if (!checkIn || !checkOut) {
      skipped.push({ row: i + 2, reason: 'Missing check-in or check-out date' });
      continue;
    }
    if (existingIds.has(bookingId)) {
      skipped.push({ row: i + 2, reason: `Booking ID ${bookingId} already exists` });
      continue;
    }

    const quantity = Math.max(1, parseInt(getField(row, 'quantity'), 10) || 1);
    const bookingDate = getField(row, 'booking_date') || new Date().toISOString().split('T')[0];
    const isPast = new Date(checkOut) < new Date();

    imported.push({
      id: bookingId,
      partner_id: partnerIdNum,
      booking_date: bookingDate,
      check_in_date: checkIn,
      check_out_date: checkOut,
      quantity,
      rate_sgd: RATE_SGD.toFixed(2),
      line_total_sgd: (quantity * RATE_SGD).toFixed(2),
      booking_status: isPast ? 'Fulfilled' : 'Pending',
      billing_status: 'Uninvoiced',
      invoice_id: null,
      created_at: new Date().toISOString(),
      partner_name: meta.name,
    });
    existingIds.add(bookingId);
    nextSeq++;
  }

  if (imported.length > 0) {
    writeBookings([...existingBookings, ...imported]);
  }

  return { success: true, message: `Imported ${imported.length} bookings`, imported: imported.length, skipped };
}
