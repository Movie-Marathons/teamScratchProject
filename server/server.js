const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables early
dotenv.config();

// Local modules
const db = require('./db');
const { getCinemas } = require('./api/cinemaAPI.js');
// const { getLandmarks } = require('./api/landMarks.js');
const landmarksRouter = require('./routes/landmarks');
const cinemasRouter = require('./routes/cinemas.js');
const cinemaShowTimesRouter = require('./routes/cinemaShowTimes.js');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/sandbox', getCinemas);

app.use('/api', landmarksRouter);
app.use('/api/cinemas', cinemasRouter);
app.use('/api/cinemashowtimes', cinemaShowTimesRouter);

// Placeholder routes until controllers/routes are set up
app.get('/api/moviePosters', (_req, res) => res.status(501).json({ error: 'Movie Posters not implemented' }));

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
