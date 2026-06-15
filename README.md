# HeyMax Billing & Reconciliation Dashboard

A B2B reconciliation and invoicing dashboard for HeyMax's OTA/channel partners (Agoda, Booking.com, Expedia). Tracks bookings, generates draft invoices, and reconciles payments — with support for bulk CSV/XLSX ingestion and flexible column mapping.

**Stack:**
- **Backend:** Node.js + Express, MySQL (`mysql2`)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (includes npm)
- [MySQL](https://dev.mysql.com/downloads/) 8.x (running locally or accessible remotely)

---

## 1. Clone the repository

```bash
git clone https://github.com/AbhimanyuV04/HeyMaxDashboard.git
cd HeyMaxDashboard
```

---

## 2. Database setup

1. Make sure MySQL is running and you have a user/password that can create databases.
2. Run the schema script. This creates the `heymax_dashboard` database and its tables (`partners`, `bookings`, `invoices`):

   ```bash
   mysql -u root -p < schema.sql
   ```

---

## 3. Backend setup

From the project root:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file by copying the example and filling in your MySQL credentials:

   ```bash
   cp .env.example .env
   ```

   `.env` variables:

   | Variable      | Description                          | Default             |
   | ------------- | ------------------------------------- | ------------------- |
   | `DB_HOST`     | MySQL host                            | `localhost`          |
   | `DB_PORT`     | MySQL port                            | `3306`               |
   | `DB_USER`     | MySQL username                        | `root`               |
   | `DB_PASSWORD` | MySQL password                        | *(empty)*            |
   | `DB_NAME`     | Database name                         | `heymax_dashboard`   |
   | `PORT`        | Port the API server listens on        | `5000`               |

3. (Optional) Seed the database with sample partners and bookings for local testing:

   ```bash
   npm run seed
   ```

4. Start the API server:

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`. Verify it's healthy:

   ```bash
   curl http://localhost:5000/api/health
   ```

---

## 4. Frontend setup

In a separate terminal, from the project root:

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

> Note: The frontend expects the API to be running at `http://localhost:5000/api`. If you change the backend `PORT`, update `API_BASE_URL` in `frontend/src/services/api.ts` accordingly.

---

## 5. Using the dashboard

- **Bookings Ledger** — view, filter (by Partner, Stay Status, Billing Status), and select bookings.
- **Import Bookings** — click "Import Bookings" to launch the mapping wizard:
  1. Upload a `.csv` or `.xlsx` file and select the source Partner.
  2. Review the auto-matched column mapping (Booking ID, Booking Date, Check-in/Check-out Date, Quantity).
  3. Confirm and execute the import — rows are upserted into `bookings`.
- **Generate Draft Invoice** — select eligible rows (Stayed + Uninvoiced) and generate a draft invoice per partner.
- **Invoices** — mark invoices as paid individually or in bulk.

---

## Project structure

```
HeyMaxDashboard/
├── server.js              # Express app entrypoint
├── db.js                   # MySQL connection pool
├── schema.sql              # Database schema
├── seed.js                 # Sample data seeder
├── src/routes/billing.js   # API routes (bookings, invoices, uploads, webhooks)
└── frontend/               # React + Vite dashboard
    └── src/
        ├── components/     # UI components (ledger table, upload wizard, etc.)
        ├── context/         # BillingContext (data + refreshData)
        ├── services/api.ts  # API client
        └── utils/csvMapping.ts # CSV/XLSX header parsing & auto-mapping
```
