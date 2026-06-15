require('dotenv').config();
const pool = require('./db');

const RATE_SGD = 0.5;
const GST_RATE = 0.09;

const PARTNERS = [
  { name: 'Agoda', contact_email: 'finance@agoda.com', uen: '201001234A', prefix: 'AGD' },
  { name: 'Booking.com', contact_email: 'billing@booking.com', uen: '201198765B', prefix: 'BDC' },
  { name: 'Expedia', contact_email: 'ap@expedia.com', uen: '201245678C', prefix: 'EXP' },
];

const BOOKINGS_PER_PARTNER = 13; // 3 partners * 13 = 39 bookings

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toSqlDate(date) {
  return date.toISOString().split('T')[0];
}

function buildBooking(partnerId, prefix, seq, today) {
  const id = `${prefix}-${String(100000 + seq)}`;
  const quantity = randInt(1, 4);
  const line_total_sgd = (quantity * RATE_SGD).toFixed(2);

  // Roll a category: 55% past stayed, 25% future pending, 20% cancelled
  const roll = Math.random();
  let checkIn, checkOut, bookingDate, booking_status, billing_status;

  if (roll < 0.55) {
    // Past stay, already checked out
    checkOut = addDays(today, -randInt(1, 90));
    checkIn = addDays(checkOut, -randInt(1, 5));
    bookingDate = addDays(checkIn, -randInt(3, 30));
    booking_status = 'Stayed';
    billing_status = pick(['Uninvoiced', 'Uninvoiced', 'Invoiced', 'Invoiced', 'Paid']);
  } else if (roll < 0.8) {
    // Future stay, not yet checked in
    checkIn = addDays(today, randInt(1, 60));
    checkOut = addDays(checkIn, randInt(1, 5));
    bookingDate = addDays(today, -randInt(0, 15));
    booking_status = 'Pending';
    billing_status = 'Uninvoiced';
  } else {
    // Cancelled booking (mix of past and future dated stays)
    if (Math.random() < 0.5) {
      checkOut = addDays(today, -randInt(1, 60));
      checkIn = addDays(checkOut, -randInt(1, 5));
    } else {
      checkIn = addDays(today, randInt(1, 45));
      checkOut = addDays(checkIn, randInt(1, 5));
    }
    bookingDate = addDays(checkIn, -randInt(3, 30));
    booking_status = 'Cancelled';
    billing_status = 'Uninvoiced';
  }

  return {
    id,
    partner_id: partnerId,
    booking_date: toSqlDate(bookingDate),
    check_in_date: toSqlDate(checkIn),
    check_out_date: toSqlDate(checkOut),
    quantity,
    rate_sgd: RATE_SGD.toFixed(2),
    line_total_sgd,
    booking_status,
    billing_status,
  };
}

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Clearing existing data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE bookings');
    await conn.query('TRUNCATE TABLE invoices');
    await conn.query('TRUNCATE TABLE partners');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Inserting partners...');
    const partnerIds = [];
    for (const p of PARTNERS) {
      const [result] = await conn.query(
        'INSERT INTO partners (name, contact_email, uen) VALUES (?, ?, ?)',
        [p.name, p.contact_email, p.uen]
      );
      partnerIds.push(result.insertId);
    }

    console.log('Inserting bookings...');
    const today = new Date();
    let totalBookings = 0;
    for (let i = 0; i < PARTNERS.length; i++) {
      for (let seq = 1; seq <= BOOKINGS_PER_PARTNER; seq++) {
        const booking = buildBooking(partnerIds[i], PARTNERS[i].prefix, seq, today);
        await conn.query(
          `INSERT INTO bookings
            (id, partner_id, booking_date, check_in_date, check_out_date,
             quantity, rate_sgd, line_total_sgd, booking_status, billing_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            booking.id,
            booking.partner_id,
            booking.booking_date,
            booking.check_in_date,
            booking.check_out_date,
            booking.quantity,
            booking.rate_sgd,
            booking.line_total_sgd,
            booking.booking_status,
            booking.billing_status,
          ]
        );
        totalBookings++;
      }
    }
    console.log(`Inserted ${totalBookings} bookings.`);

    console.log('Generating invoices for already-billed bookings...');
    let invoiceSeq = 1;
    for (let i = 0; i < PARTNERS.length; i++) {
      for (const status of ['Invoiced', 'Paid']) {
        const [rows] = await conn.query(
          `SELECT id, line_total_sgd FROM bookings
           WHERE partner_id = ? AND billing_status = ? AND invoice_id IS NULL`,
          [partnerIds[i], status]
        );
        if (rows.length === 0) continue;

        const subtotal = rows.reduce((sum, r) => sum + Number(r.line_total_sgd), 0);
        const gst = Number((subtotal * GST_RATE).toFixed(2));
        const total = Number((subtotal + gst).toFixed(2));
        const issueDate = addDays(today, -randInt(5, 45));
        const dueDate = addDays(issueDate, 30);
        const invoiceNumber = `HMAX-2026-${String(invoiceSeq).padStart(3, '0')}`;
        const invoiceStatus = status === 'Paid' ? 'Paid' : 'Sent';

        const [result] = await conn.query(
          `INSERT INTO invoices
            (invoice_number, partner_id, issue_date, due_date, subtotal_sgd, gst_sgd, total_sgd, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceNumber,
            partnerIds[i],
            toSqlDate(issueDate),
            toSqlDate(dueDate),
            subtotal.toFixed(2),
            gst.toFixed(2),
            total.toFixed(2),
            invoiceStatus,
          ]
        );
        const invoiceId = result.insertId;

        await conn.query(
          `UPDATE bookings SET invoice_id = ? WHERE id IN (?)`,
          [invoiceId, rows.map((r) => r.id)]
        );

        console.log(`  -> ${invoiceNumber} (${invoiceStatus}) for ${PARTNERS[i].name}: ${rows.length} bookings, total S$${total.toFixed(2)}`);
        invoiceSeq++;
      }
    }

    console.log('Seed complete.');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
