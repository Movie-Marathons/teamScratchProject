const { ingestForPoster, listByFilmId } = require('../services/MoviePoster.service.js');

// GET /api/moviePosters
// NOTE: Read-only listing can be wired here later (e.g., imagesRepo.listByFilmId).
// For now, this handler optionally supports a temporary "mode=ingest" to fetch & save via GET
// during early testing — but the preferred path is POST /api/moviePosters/fetch.
exports.getMoviePosters = async (req, res, next) => {
  try {
    const { filmId, imdbId, altText, mode, fetch, size_category, orientation, prefer, light } = req.query || {};

    // Temporary convenience: allow GET-triggered ingest while wiring UI/Postman
    if (mode === 'ingest' || fetch === '1') {
      const data = await ingestForPoster({ filmId, imdbId, altText, size_category, orientation, prefer, light: light === '1' || light === 'true' });
      return res.status(201).json({ success: true, data, meta: { ingested: true, via: 'GET (temporary)' } });
    }

    // Normal listing path when not ingesting
    if (filmId) {
      const posters = await listByFilmId(filmId);
      return res.status(200).json({ success: true, data: posters });
    }

    const err = new Error('Listing posters not implemented yet. Use POST /api/moviePosters/fetch to ingest.');
    err.status = 501;
    throw err;
  } catch (err) {
    next(err);
  }
};

// POST /api/moviePosters/fetch
// Body: { imdbId?: string, filmId?: string, altText?: string }
// Calls the service to fetch a poster from the external provider and save to DB
exports.fetchAndSavePoster = async (req, res, next) => {
  try {
    const { imdbId, filmId, movieGluFilmId, altText, size_category, orientation, prefer, light } = req.body || {};

    if (!imdbId && !filmId) {
      const e = new Error('imdbId or filmId is required');
      e.status = 400;
      throw e;
    }

    const data = await ingestForPoster({ imdbId, filmId, movieGluFilmId, altText, size_category, orientation, prefer, light });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/moviePosters/:filmId
exports.listByFilmId = async (req, res, next) => {
  try {
    const { filmId } = req.params;
    const posters = await listByFilmId(filmId);
    return res.status(200).json({ success: true, data: posters });
  } catch (err) {
    next(err);
  }
};