require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const billingRoutes = require('./src/routes/billing');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', billingRoutes);

// Health check: verifies the API is up and the DB connection works
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`HeyMax Dashboard API running on port ${PORT}`);
});
