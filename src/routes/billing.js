const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');
const { Readable } = require('stream');
const pool = require('../../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const GST_RATE = 0.09;
const RATE_SGD = 0.5;
const VALID_BOOKING_STATUSES = ['Pending', 'Stayed', 'Cancelled'];
const VALID_BILLING_STATUSES = ['Uninvoiced', 'Invoiced', 'Paid'];

// Normalizes a date-like value (e.g. "2026-03-14", "03/14/2026") to 'YYYY-MM-DD', or null if invalid.
function toSqlDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Capitalizes the first letter so CSV values like "stayed" match the ENUM ('Stayed').
function capitalize(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// Reads the first worksheet of an .xlsx workbook and returns rows in the same
// shape as parseCsvBuffer: an array of objects keyed by the header row's cell values.
function parseXlsxBuffer(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => (h === undefined || h === null ? '' : String(h).trim()));

  return rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.length > 0)
    .map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        const cell = row[idx];
        obj[header] = cell === undefined || cell === null ? '' : cell;
      });
      return obj;
    });
}

// True if the uploaded file is an .xlsx workbook (by extension or MIME type).
function isXlsxFile(file) {
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return file.mimetype === XLSX_MIME || /\.xlsx$/i.test(file.originalname || '');
}

// ------------------------------------------------------------
// GET /api/metrics
// ------------------------------------------------------------
router.get('/metrics', async (req, res) => {
  try {
    const [
      [accruedRow],
      [readyRow],
      [collectedRow],
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(line_total_sgd), 0) AS total
         FROM bookings
         WHERE booking_status IN ('Pending', 'Stayed') AND billing_status = 'Uninvoiced'`
      ).then(([rows]) => rows),
      pool.query(
        `SELECT COALESCE(SUM(line_total_sgd), 0) AS total
         FROM bookings
         WHERE booking_status = 'Stayed' AND billing_status = 'Uninvoiced' AND check_out_date <= NOW()`
      ).then(([rows]) => rows),
      pool.query(
        `SELECT COALESCE(SUM(total_sgd), 0) AS total
         FROM invoices
         WHERE status = 'Paid'`
      ).then(([rows]) => rows),
    ]);

    res.json({
      total_accrued_pipeline: Number(accruedRow.total),
      ready_to_invoice: Number(readyRow.total),
      total_collected: Number(collectedRow.total),
    });
  } catch (err) {
    console.error('GET /api/metrics failed:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ------------------------------------------------------------
// GET /api/bookings
// ------------------------------------------------------------
router.get('/bookings', async (req, res) => {
  try {
    const { partner_id, booking_status, billing_status } = req.query;

    let sql = `
      SELECT b.*, p.name AS partner_name
      FROM bookings b
      JOIN partners p ON p.id = b.partner_id
      WHERE 1 = 1
    `;
    const params = [];

    if (partner_id) {
      sql += ' AND b.partner_id = ?';
      params.push(partner_id);
    }

    if (booking_status) {
      sql += ' AND b.booking_status = ?';
      params.push(booking_status);
    }

    if (billing_status) {
      sql += ' AND b.billing_status = ?';
      params.push(billing_status);
    }

    sql += ' ORDER BY b.check_out_date DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/bookings failed:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ------------------------------------------------------------
// POST /api/invoices/generate
// ------------------------------------------------------------
router.post('/invoices/generate', async (req, res) => {
  const { partner_id, booking_ids } = req.body;

  if (!partner_id || !Array.isArray(booking_ids) || booking_ids.length === 0) {
    return res.status(400).json({ error: 'partner_id and a non-empty booking_ids array are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // a. Validation: fetch and lock the target bookings
    const [bookings] = await connection.query(
      `SELECT id, partner_id, line_total_sgd, booking_status, billing_status
       FROM bookings
       WHERE id IN (?)
       FOR UPDATE`,
      [booking_ids]
    );

    if (bookings.length !== booking_ids.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'One or more booking_ids were not found' });
    }

    const invalid = bookings.filter(
      (b) =>
        Number(b.partner_id) !== Number(partner_id) ||
        b.booking_status !== 'Stayed' ||
        b.billing_status !== 'Uninvoiced'
    );

    if (invalid.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'One or more bookings are not eligible for invoicing (must belong to the partner, be Stayed, and Uninvoiced)',
        invalid_booking_ids: invalid.map((b) => b.id),
      });
    }

    // b. Invoice math
    const subtotal = bookings.reduce((sum, b) => sum + Number(b.line_total_sgd), 0);
    const gst = Number((subtotal * GST_RATE).toFixed(2));
    const total = Number((subtotal + gst).toFixed(2));

    // c. Sequential invoice number for the current year, e.g. HMAX-2026-006
    const year = new Date().getFullYear();
    const [seqRows] = await connection.query(
      `SELECT invoice_number FROM invoices
       WHERE invoice_number LIKE ?
       ORDER BY id DESC LIMIT 1
       FOR UPDATE`,
      [`HMAX-${year}-%`]
    );

    let nextSeq = 1;
    if (seqRows.length > 0) {
      const lastSeq = parseInt(seqRows[0].invoice_number.split('-').pop(), 10);
      nextSeq = lastSeq + 1;
    }
    const invoiceNumber = `HMAX-${year}-${String(nextSeq).padStart(3, '0')}`;

    // d. Create the invoice and update the booking rows
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const toSqlDate = (d) => d.toISOString().split('T')[0];

    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices
        (invoice_number, partner_id, issue_date, due_date, subtotal_sgd, gst_sgd, total_sgd, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [
        invoiceNumber,
        partner_id,
        toSqlDate(issueDate),
        toSqlDate(dueDate),
        subtotal.toFixed(2),
        gst.toFixed(2),
        total.toFixed(2),
      ]
    );
    const invoiceId = invoiceResult.insertId;

    await connection.query(
      `UPDATE bookings SET billing_status = 'Invoiced', invoice_id = ? WHERE id IN (?)`,
      [invoiceId, booking_ids]
    );

    // e. Commit and return the new invoice
    await connection.commit();

    const [[invoice]] = await connection.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json(invoice);
  } catch (err) {
    await connection.rollback();
    console.error('POST /api/invoices/generate failed:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  } finally {
    connection.release();
  }
});

// ------------------------------------------------------------
// GET /api/invoices
// ------------------------------------------------------------
router.get('/invoices', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.*, p.name AS partner_name, p.contact_email AS partner_contact_email, p.uen AS partner_uen
       FROM invoices i
       JOIN partners p ON p.id = i.partner_id
       ORDER BY i.issue_date DESC, i.id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/invoices failed:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ------------------------------------------------------------
// PUT /api/invoices/:id/pay
// ------------------------------------------------------------
router.put('/invoices/:id/pay', async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // a. Locate and lock the invoice, ensure it isn't already Paid
    const [[invoice]] = await connection.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [id]);

    if (!invoice) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'Paid') {
      await connection.rollback();
      return res.status(400).json({ error: 'Invoice has already been marked as Paid' });
    }

    // b. Settle the invoice
    await connection.query(`UPDATE invoices SET status = 'Paid' WHERE id = ?`, [id]);

    // c. Settle the underlying booking assets
    await connection.query(
      `UPDATE bookings SET billing_status = 'Paid' WHERE invoice_id = ? AND billing_status = 'Invoiced'`,
      [id]
    );

    // d. Commit and return the updated invoice
    await connection.commit();

    const [[updatedInvoice]] = await connection.query('SELECT * FROM invoices WHERE id = ?', [id]);
    res.status(200).json(updatedInvoice);
  } catch (err) {
    await connection.rollback();
    console.error(`PUT /api/invoices/${id}/pay failed:`, err);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  } finally {
    connection.release();
  }
});

// ------------------------------------------------------------
// PUT /api/invoices/bulk-pay
// ------------------------------------------------------------
router.put('/invoices/bulk-pay', async (req, res) => {
  const { invoice_ids } = req.body;

  if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return res.status(400).json({ error: 'invoice_ids must be a non-empty array' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // a. Locate and lock the target invoices, ensure none are already Paid
    const [invoices] = await connection.query(
      `SELECT id, status FROM invoices WHERE id IN (?) FOR UPDATE`,
      [invoice_ids]
    );

    if (invoices.length !== invoice_ids.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'One or more invoice_ids were not found' });
    }

    const alreadyPaid = invoices.filter((inv) => inv.status === 'Paid');
    if (alreadyPaid.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'One or more invoices have already been marked as Paid',
        invalid_invoice_ids: alreadyPaid.map((inv) => inv.id),
      });
    }

    // b. Settle the invoices
    await connection.query(`UPDATE invoices SET status = 'Paid' WHERE id IN (?)`, [invoice_ids]);

    // c. Settle the underlying booking assets
    await connection.query(
      `UPDATE bookings SET billing_status = 'Paid' WHERE invoice_id IN (?) AND billing_status = 'Invoiced'`,
      [invoice_ids]
    );

    // d. Commit and return the updated invoices
    await connection.commit();

    const [updatedInvoices] = await connection.query('SELECT * FROM invoices WHERE id IN (?)', [invoice_ids]);
    res.status(200).json(updatedInvoices);
  } catch (err) {
    await connection.rollback();
    console.error('PUT /api/invoices/bulk-pay failed:', err);
    res.status(500).json({ error: 'Failed to mark invoices as paid' });
  } finally {
    connection.release();
  }
});

// ------------------------------------------------------------
// POST /api/bookings/upload
// ------------------------------------------------------------
router.post('/bookings/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A CSV or XLSX file is required (form field name: "file")' });
  }

  // Optional column mapping: { booking_id: "Booking ID", booking_date: "Reservation Date", ... }
  // Lets partner CSVs with arbitrary headers be ingested without renaming columns first.
  let mapping = {};
  if (req.body.mapping) {
    try {
      mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
    } catch (err) {
      return res.status(400).json({ error: 'mapping must be valid JSON' });
    }
    if (typeof mapping !== 'object' || mapping === null || Array.isArray(mapping)) {
      return res.status(400).json({ error: 'mapping must be a JSON object' });
    }
  }

  try {
    // Both parsers resolve to the same shape: an array of objects keyed by
    // the source file's header row, so the mapping logic below is format-agnostic.
    const rawRows = isXlsxFile(req.file) ? parseXlsxBuffer(req.file.buffer) : await parseCsvBuffer(req.file.buffer);
    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data rows' });
    }

    const [partnerRows] = await pool.query('SELECT id FROM partners');
    const validPartnerIds = new Set(partnerRows.map((p) => p.id));

    // Optional form field: used when a CSV row is missing/has an invalid partner_id.
    const formPartnerId = Number(req.body.partner_id);
    const hasFormPartnerId = Number.isInteger(formPartnerId) && validPartnerIds.has(formPartnerId);

    const now = new Date();
    const validRows = [];
    const skipped = [];

    // Reads a database field's value from a raw CSV row: prefers the user-supplied
    // column name from `mapping`, falling back to a normalized header match.
    function getField(raw, normalizedRow, field) {
      const mappedColumn = mapping[field];
      if (mappedColumn && raw[mappedColumn] !== undefined) {
        const value = raw[mappedColumn];
        return typeof value === 'string' ? value.trim() : value;
      }
      return normalizedRow[field];
    }

    rawRows.forEach((raw, index) => {
      // Normalize header keys: "Booking ID" -> "booking_id"
      const normalizedRow = {};
      Object.entries(raw).forEach(([key, value]) => {
        normalizedRow[key.trim().toLowerCase().replace(/\s+/g, '_')] = typeof value === 'string' ? value.trim() : value;
      });

      const rowNumber = index + 2; // account for the header row (1-indexed)
      const id = getField(raw, normalizedRow, 'booking_id') || normalizedRow.id;
      let partnerId = Number(getField(raw, normalizedRow, 'partner_id'));
      if ((!Number.isInteger(partnerId) || !validPartnerIds.has(partnerId)) && hasFormPartnerId) {
        partnerId = formPartnerId;
      }
      const bookingDate = toSqlDate(getField(raw, normalizedRow, 'booking_date'));
      const checkInDate = toSqlDate(getField(raw, normalizedRow, 'check_in_date'));
      const checkOutDate = toSqlDate(getField(raw, normalizedRow, 'check_out_date'));
      const quantity = parseInt(getField(raw, normalizedRow, 'quantity'), 10);

      if (!id) {
        skipped.push({ row: rowNumber, reason: 'Missing booking_id' });
        return;
      }
      if (!Number.isInteger(partnerId) || !validPartnerIds.has(partnerId)) {
        skipped.push({ row: rowNumber, reason: `Invalid or unknown partner_id "${getField(raw, normalizedRow, 'partner_id')}"` });
        return;
      }
      if (!bookingDate || !checkInDate || !checkOutDate) {
        skipped.push({ row: rowNumber, reason: 'Invalid booking_date, check_in_date, or check_out_date' });
        return;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        skipped.push({ row: rowNumber, reason: `Invalid quantity "${getField(raw, normalizedRow, 'quantity')}"` });
        return;
      }

      const lineTotalSgd = (quantity * RATE_SGD).toFixed(2);
      const checkedOutInPast = new Date(checkOutDate) < now;

      let bookingStatus = capitalize(getField(raw, normalizedRow, 'booking_status'));
      if (!VALID_BOOKING_STATUSES.includes(bookingStatus)) {
        bookingStatus = checkedOutInPast ? 'Stayed' : 'Pending';
      }

      let billingStatus = capitalize(getField(raw, normalizedRow, 'billing_status'));
      if (!VALID_BILLING_STATUSES.includes(billingStatus)) {
        billingStatus = 'Uninvoiced';
      }

      validRows.push({
        id,
        partner_id: partnerId,
        booking_date: bookingDate,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        quantity,
        rate_sgd: RATE_SGD.toFixed(2),
        line_total_sgd: lineTotalSgd,
        booking_status: bookingStatus,
        billing_status: billingStatus,
      });
    });

    if (validRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows to import', skipped });
    }

    // Batch upsert: re-uploading a CSV updates existing rows in place rather than failing
    // on duplicate booking_id primary keys. billing_status is intentionally left untouched
    // on update so re-syncing stay data doesn't clobber an already-invoiced/paid booking.
    const placeholders = validRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = validRows.flatMap((r) => [
      r.id,
      r.partner_id,
      r.booking_date,
      r.check_in_date,
      r.check_out_date,
      r.quantity,
      r.rate_sgd,
      r.line_total_sgd,
      r.booking_status,
      r.billing_status,
    ]);

    await pool.query(
      `INSERT INTO bookings
        (id, partner_id, booking_date, check_in_date, check_out_date, quantity, rate_sgd, line_total_sgd, booking_status, billing_status)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         partner_id = VALUES(partner_id),
         booking_date = VALUES(booking_date),
         check_in_date = VALUES(check_in_date),
         check_out_date = VALUES(check_out_date),
         quantity = VALUES(quantity),
         rate_sgd = VALUES(rate_sgd),
         line_total_sgd = VALUES(line_total_sgd),
         booking_status = VALUES(booking_status)`,
      values
    );

    res.status(201).json({
      success: true,
      message: `Processed ${rawRows.length} row(s): ${validRows.length} imported, ${skipped.length} skipped`,
      imported: validRows.length,
      skipped,
    });
  } catch (err) {
    console.error('POST /api/bookings/upload failed:', err);
    res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
});

// ------------------------------------------------------------
// POST /api/webhooks/booking
// ------------------------------------------------------------
router.post('/webhooks/booking', async (req, res) => {
  try {
    const { booking_id, partner_id, booking_date, check_in_date, check_out_date, quantity, status } = req.body;

    if (!booking_id || typeof booking_id !== 'string') {
      return res.status(400).json({ error: 'booking_id is required and must be a string' });
    }

    const partnerId = Number(partner_id);
    if (!Number.isInteger(partnerId)) {
      return res.status(400).json({ error: 'partner_id is required and must be an integer' });
    }

    const bookingDate = toSqlDate(booking_date);
    const checkInDate = toSqlDate(check_in_date);
    const checkOutDate = toSqlDate(check_out_date);
    if (!bookingDate || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'booking_date, check_in_date, and check_out_date must be valid dates' });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity is required and must be a positive integer' });
    }

    if (!VALID_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}` });
    }

    const [[partner]] = await pool.query('SELECT id FROM partners WHERE id = ?', [partnerId]);
    if (!partner) {
      return res.status(400).json({ error: `partner_id ${partnerId} does not exist` });
    }

    const lineTotalSgd = (qty * RATE_SGD).toFixed(2);

    await pool.query(
      `INSERT INTO bookings
        (id, partner_id, booking_date, check_in_date, check_out_date, quantity, rate_sgd, line_total_sgd, booking_status, billing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Uninvoiced')
       ON DUPLICATE KEY UPDATE
         partner_id = VALUES(partner_id),
         booking_date = VALUES(booking_date),
         check_in_date = VALUES(check_in_date),
         check_out_date = VALUES(check_out_date),
         quantity = VALUES(quantity),
         rate_sgd = VALUES(rate_sgd),
         line_total_sgd = VALUES(line_total_sgd),
         booking_status = VALUES(booking_status)`,
      [booking_id, partnerId, bookingDate, checkInDate, checkOutDate, qty, RATE_SGD.toFixed(2), lineTotalSgd, status]
    );

    res.json({ success: true, message: 'Booking synced successfully' });
  } catch (err) {
    console.error('POST /api/webhooks/booking failed:', err);
    res.status(500).json({ error: 'Failed to sync booking' });
  }
});

module.exports = router;
