const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
require('dotenv').config();

// Load environment variables early
// dotenv.config();

const { MG_CLIENT, MG_API_KEY, MG_AUTH, MG_TERRITORY, MG_API_VERSION, MG_GEO } = process.env;
app.get('/health', (_req, res) => res.json({ ok: true }));

// Local modules
const db = require('./db');
const { getCinemas } = require('./api/cinemaAPI.js');
const { getLandmarks } = require('./api/landMarks.js');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/sandbox', getCinemas);

const landmarksRouter = require('./routes/landmarks');
app.use('/api', landmarksRouter);

// Placeholder routes until controllers/routes are set up
app.get('/api/cinemas', (_req, res) => res.status(501).json({ error: 'listCinemas not implemented' }));
app.get('/api/cinemashowtimes', (_req, res) => res.status(501).json({ error: 'cinemaShowTimes not implemented' }));

// Database connection test
(async () => {
  try {
    const r = await db.query('SELECT now() as now');
    console.log('PG connected. Time:', r.rows[0].now);
  } catch (e) {
    console.error('PG connection failed:', e.message);
  }
})();

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  const status = err?.status || err?.response?.status || 500;
  const message = err?.message || err?.response?.data || 'Internal Server Error';
  res.status(status).json({ error: message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
