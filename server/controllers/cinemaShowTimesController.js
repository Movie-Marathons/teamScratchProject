const { ingestForCinema } = require('../services/cinemaShowTimes.service.js');

// GET /api/cinemaShowTimes
// Query parameters: cinema_id (number), date (YYYY-MM-DD), show_date_id (uuid, optional)
async function getCinemasShowTimes(req, res, next) {
  const q = req.query || {};

  const cinemaExternalId = Number(q.cinema_id);
  const dateISO = String(q.date ?? '').slice(0, 10);
  const rawShowDateId = q.show_date_id;

  // Basic validations (consistent with our service)
  if (!cinemaExternalId || Number.isNaN(cinemaExternalId)) {
    return res.status(400).json({ ok: false, error: 'cinema_id (number) is required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return res.status(400).json({ ok: false, error: 'date must be in YYYY-MM-DD format' });
  }
  // Optional UUID: only pass it through if it looks valid. Otherwise, let the service resolve/create a show_date.
  let showDateId = null;
  if (typeof rawShowDateId === 'string') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(rawShowDateId)) {
      showDateId = rawShowDateId;
    }
  }

  try {
    const result = await ingestForCinema({ cinemaExternalId, dateISO, showDateId });
    // Ensure a stable shape with ok: true
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.warn('[cinemaShowTimesController] fallback to safe 200:', err?.message || err);
    return res.status(200).json({
      ok: true,
      reason: 'CONTROLLER_FALLBACK',
      cinemaExternalId,
      dateISO,
      show_date_id: showDateId || null,
      counts: {},
      films: [],
    });
  }
}

module.exports = { getCinemasShowTimes };