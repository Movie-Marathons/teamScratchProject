// controllers/cinemaController.js
const cinemaService = require('../services/cinema.service.js');

// example
const { buildCacheKey, getCached, setCached, invalidateByPattern } = require("../utils/cache");

async function getCinemasByZipController(req, res, next) {
  const { zip } = req.query;
  if (!zip) {
    return res.status(400).json({ error: 'zip is required' });
  }

  // Cache: attempt read-through by zip
  const key = buildCacheKey("cinemas", req.path, { zip });
  const cached = await getCached(key);
  if (cached) {
    return res.json(cached);
  }

  try {
    const cinemas = await cinemaService.getByZip(zip);
    // Invalidate other cached variants for cinemas
    await invalidateByPattern("cinemas:*");
    // Store in cache for 10 minutes
    await setCached(key, { ok: true, zip, cinemas }, 600);
    res.status(200).json({ ok: true, zip, cinemas });
  } catch (err) {
    console.warn('[cinemaController] getCinemasByZipController fallback:', err?.message || err);
    // Return a safe 200 with empty results so the frontend stays stable
    return res.status(200).json({ ok: true, zip, cinemas: [], note: 'served from DB only or external unavailable' });
  }
}

module.exports = { getCinemasByZipController };