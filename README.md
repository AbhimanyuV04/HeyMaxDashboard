# HeyMax Billing & Reconciliation Dashboard

A B2B reconciliation and invoicing dashboard for HeyMax's affiliate booking partners (Agoda, Booking.com, Expedia, Trip.com). Tracks bookings, generates draft invoices, and reconciles payments — with support for bulk CSV/XLSX ingestion and flexible column mapping.

**Stack:**
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Data:** Browser `localStorage` (no backend or database required)

---

## Quickstart

```bash
git clone https://github.com/AbhimanyuV04/HeyMaxDashboard.git
cd HeyMaxDashboard/frontend
npm install
npm run dev
```

Open **http://localhost:5173**. That's it — no backend, no database, no `.env` file needed.

Sample data (52 bookings, 8 invoices across all 4 partners) is seeded into `localStorage` automatically on first load.

---

## Using the dashboard

- **Bookings Ledger** — view and filter bookings by Partner, Booking Status, and Billing Status.
- **Import Bookings** — click "Import Bookings" to launch the mapping wizard:
  1. Upload a `.csv` or `.xlsx` file and select the source Partner.
  2. Review the auto-matched column mapping (Booking ID, Booking Date, Check-in/Check-out Date, Quantity).
  3. Confirm and execute — rows are parsed client-side and appended to local state.
- **Generate Draft Invoice** — select eligible rows (Fulfilled + Uninvoiced) and generate a draft invoice per partner.
- **Invoices Hub** — filter by Partner or status tab; mark invoices as paid individually or in bulk.

---

## Resetting sample data

To wipe and re-seed, open **DevTools → Application → Local Storage**, delete `heymax_bookings` and `heymax_invoices`, then refresh the page.

---

## Building for deployment

```bash
cd frontend
npm run build
```

Produces a `frontend/dist/` folder — drop it on any static host (Netlify, Vercel, GitHub Pages, S3, etc.).

---

## Project structure

```
HeyMaxDashboard/
└── frontend/               # React + Vite SPA (the only thing you need to run)
    └── src/
        ├── components/     # UI components (ledger, upload wizard, invoice preview, etc.)
        ├── context/        # BillingContext — data layer wired to localStorage
        ├── services/api.ts # localStorage simulator (all data operations live here)
        ├── types/          # Shared TypeScript types and partner constants
        └── utils/csvMapping.ts # CSV/XLSX header parsing & auto-mapping
```

> **Note:** The repository also contains a legacy Node.js + MySQL backend (`server.js`, `db.js`, `schema.sql`, `seed.js`, `src/routes/`) on the `main` branch from an earlier version. It is not used by the current SPA but is preserved for reference and rollback.
