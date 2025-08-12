const express = require('express');
const axios = require('axios');
const router = express.Router();

const {
  MG_BASE_URL = 'https://api-gate2.movieglu.com', // add to .env if you use a cache/proxy instead
  MG_CLIENT,
  MG_API_KEY,
  MG_AUTH,
  MG_TERRITORY,
  MG_API_VERSION,
  MG_GEO,
} = process.env;

// Utility: MovieGlu expects a "device-datetime" header (local ISO without Z)
function deviceDateTime() {
  // e.g., "2025-08-11T21:05:00"
  const d = new Date();
  return d.toISOString().slice(0, 19);
}

// GET /api/showtimes?zip=11201&date=2025-08-12&time=18:00
router.get('/showtimes', async (req, res, next) => {
  try {
    const { zip = '11201', date, time } = req.query;

    // If your cloud cache expects lat/lng instead of zip,
    // do ZIP -> lat/lng here (or pass zip through if your cache handles it).

    const headers = {
      client: MG_CLIENT,
      'x-api-key': MG_API_KEY,
      authorization: MG_AUTH,
      territory: MG_TERRITORY,
      'api-version': MG_API_VERSION,
      geolocation: MG_GEO,           // format: "lat;lng"
      'device-datetime': deviceDateTime(),
    };

    // Example: if your cache sits in front of MovieGlu and accepts zip/date/time:
    const url = `${MG_BASE_URL}/showtimes`; // <- change to your actual cache endpoint
    const { data } = await axios.get(url, {
      params: { zip, date, time },
      headers,
      timeout: 15000,
    });

    // Normalize to { theaters: [...] } for the client
    res.json({ theaters: data.theaters ?? data });
  } catch (err) {
    // Uniform error shape
    const status = err?.response?.status ?? 500;
    const message = err?.response?.data ?? err.message ?? 'Showtimes fetch failed';
    res.status(status).json({ error: message });
  }
});

module.exports = router;
