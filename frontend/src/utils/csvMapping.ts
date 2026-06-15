import * as XLSX from 'xlsx';

export interface MappingField {
  key: string;
  label: string;
  required: boolean;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function isXlsxFile(file: File): boolean {
  return file.type === XLSX_MIME || /\.xlsx$/i.test(file.name);
}

export function isSupportedSpreadsheetFile(file: File): boolean {
  return isXlsxFile(file) || /\.csv$/i.test(file.name);
}

// The HeyMax booking schema fields that a partner CSV can be mapped onto.
export const REQUIRED_FIELDS: MappingField[] = [
  { key: 'booking_id', label: 'Booking ID', required: true },
  { key: 'booking_date', label: 'Booking Date', required: true },
  { key: 'check_in_date', label: 'Check-in Date', required: true },
  { key: 'check_out_date', label: 'Check-out Date', required: true },
  { key: 'quantity', label: 'Quantity (Rooms/Stays)', required: false },
];

// Known alternative header names per field, used for auto-matching.
const FIELD_ALIASES: Record<string, string[]> = {
  booking_id: [
    'booking id', 'bookingid', 'reservation id', 'reservationid',
    'reservation number', 'reservationno', 'booking reference', 'bookingref', 'id',
  ],
  booking_date: [
    'booking date', 'bookingdate', 'reservation date', 'reservationdate',
    'date booked', 'datebooked', 'created date', 'createddate',
  ],
  check_in_date: [
    'check in date', 'check-in date', 'checkindate', 'checkin', 'check-in',
    'arrival', 'arrival date', 'arrivaldate',
  ],
  check_out_date: [
    'check out date', 'check-out date', 'checkoutdate', 'checkout', 'check-out',
    'departure', 'departure date', 'departuredate', 'departure day', 'departureday',
  ],
  quantity: [
    'quantity', 'qty', 'rooms', 'rooms booked', 'roomsbooked',
    'number of rooms', 'numberofrooms', 'nights', 'stays',
  ],
};

// Lowercases and strips everything but letters/digits so "Check-Out Date",
// "check_out_date" and "CheckOut" all normalize to the same token.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Splits a CSV header line into column names, respecting quoted fields.
export function parseCsvHeaderLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map((c) => c.replace(/^"|"$/g, ''));
}

// Reads the header row from a .csv or .xlsx file, regardless of source format,
// so the mapping matrix always sees the same column-name array.
export async function extractFileHeaders(file: File): Promise<string[]> {
  if (isXlsxFile(file)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
    const headerRow = rows[0] ?? [];
    return headerRow
      .map((h) => (h === undefined || h === null ? '' : String(h).trim()))
      .filter((c) => c.length > 0);
  }

  const text = await file.text();
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  return parseCsvHeaderLine(firstLine).filter((c) => c.length > 0);
}

// Suggests a mapping from HeyMax schema fields to uploaded CSV columns by
// normalizing both the field's known aliases and the CSV headers and
// matching on equality (e.g. "CheckOut" / "check_out" -> check_out_date).
export function autoMatchColumns(columns: string[], fields: MappingField[]): Record<string, string> {
  const normalizedColumns = columns.map((col) => ({ original: col, normalized: normalize(col) }));
  const usedColumns = new Set<string>();
  const result: Record<string, string> = {};

  for (const field of fields) {
    const candidates = [field.key, ...(FIELD_ALIASES[field.key] ?? [])].map(normalize);
    const match = normalizedColumns.find(
      (col) => !usedColumns.has(col.original) && candidates.includes(col.normalized)
    );
    if (match) {
      result[field.key] = match.original;
      usedColumns.add(match.original);
    }
  }

  return result;
}
