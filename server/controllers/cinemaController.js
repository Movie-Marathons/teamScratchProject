// controllers/cinemaController.js
const cinemaService = require('../services/cinema.service.js');

async function getCinemasByZipController(req, res, next) {
  const { zip } = req.query;
  if (!zip) {
    return res.status(400).json({ error: 'zip is required' });
  }

  try {
    const cinemas = await cinemaService.getByZip(zip);
    res.status(200).json({ ok: true, zip, cinemas });
  } catch (err) {
    console.warn('[cinemaController] getCinemasByZipController fallback:', err?.message || err);
    // Return a safe 200 with empty results so the frontend stays stable
    return res.status(200).json({ ok: true, zip, cinemas: [], note: 'served from DB only or external unavailable' });
  }
}

module.exports = { getCinemasByZipController };