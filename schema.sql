-- ============================================================
-- HeyMax B2B Reconciliation & Invoicing Dashboard
-- Database Schema (MySQL)
-- Currency: SGD | Rate: S$0.50 per booking | GST: 9%
-- ============================================================

CREATE DATABASE IF NOT EXISTS heymax_dashboard;
USE heymax_dashboard;

-- Drop in FK-safe order for re-runnable migrations
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS partners;

-- ------------------------------------------------------------
-- partners: OTA / channel partners (Agoda, Booking.com, etc.)
-- ------------------------------------------------------------
CREATE TABLE partners (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  uen           VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- invoices: generated billing documents per partner
-- ------------------------------------------------------------
CREATE TABLE invoices (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  partner_id     INT NOT NULL,
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  subtotal_sgd   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  gst_sgd        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_sgd      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status         ENUM('Draft', 'Sent', 'Paid') NOT NULL DEFAULT 'Draft',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_partner FOREIGN KEY (partner_id) REFERENCES partners(id)
);

-- ------------------------------------------------------------
-- bookings: raw booking line items from provider feeds
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id              VARCHAR(50) PRIMARY KEY, -- provider booking reference
  partner_id      INT NOT NULL,
  booking_date    DATE NOT NULL,
  check_in_date   DATE NOT NULL,
  check_out_date  DATE NOT NULL,
  quantity        INT NOT NULL DEFAULT 1,
  rate_sgd        DECIMAL(10,2) NOT NULL DEFAULT 0.50,
  line_total_sgd  DECIMAL(10,2) NOT NULL,
  booking_status  ENUM('Pending', 'Stayed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  billing_status  ENUM('Uninvoiced', 'Invoiced', 'Paid') NOT NULL DEFAULT 'Uninvoiced',
  invoice_id      INT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_partner FOREIGN KEY (partner_id) REFERENCES partners(id),
  CONSTRAINT fk_bookings_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  INDEX idx_bookings_partner (partner_id),
  INDEX idx_bookings_billing_status (billing_status)
);
