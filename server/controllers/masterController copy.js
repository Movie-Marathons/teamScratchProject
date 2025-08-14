// MoviePostersController (logging enhanced)
// Controller -> delegates to service.

const service = require('../services/MoviePoster.service.js');

const NS = 'MoviePostersController';
const now = () => new Date().toISOString();
const log = (...args) => console.log(`[${NS}]`, now(), ...args);
const logErr = (...args) => console.error(`[${NS}]`, now(), ...args);

// GET /api/moviePosters
// Supports two flows:
// 1) Temporary ingest via query (?mode=ingest or ?fetch=1)
// 2) Listing via query (?filmId=<uuid>)
exports.getMoviePosters = async (req, res, next) => {
  const start = Date.now();
  try {
    const { filmId, movieGluFilmId, altText, mode, fetch, size_category, orientation, prefer, light } = req.query || {};
    log('GET /api/moviePosters', { filmId, movieGluFilmId, mode, fetch, size_category, orientation, prefer, light });

    // Ingest-on-GET convenience for early wiring
    if (mode === 'ingest' || fetch === '1' || fetch === 'true') {
      const data = await service.ingestForPoster({
        filmId,
        movieGluFilmId,
        altText,
        size_category,
        orientation,
        prefer,
        light: light === '1' || light === 'true',
      });
      log('INGEST via GET complete', { filmId, cached: data?.cached, images: data?.images?.length });
      return res.status(201).json({ success: true, data, meta: { ingested: true, via: 'GET (temporary)', ms: Date.now() - start } });
    }

    // Normal listing path
    if (filmId) {
      const posters = await service.listByFilmId(filmId);
      log('LIST posters', { filmId, count: posters?.length || 0, ms: Date.now() - start });
      return res.status(200).json({ success: true, data: posters });
    }

    const err = new Error('Provide filmId to list posters, or POST /api/moviePosters/fetch to ingest.');
    err.status = 501;
    throw err;
  } catch (err) {
    logErr('GET error', { message: err?.message, status: err?.status });
    next(err);
  }
};

// POST /api/moviePosters/fetch
// Body: { filmId: uuid (required), movieGluFilmId: number (required), altText?, size_category?, orientation?, prefer?, light? }
exports.fetchAndSavePoster = async (req, res, next) => {
  const start = Date.now();
  try {
    const { filmId, movieGluFilmId, altText, size_category, orientation, prefer, light } = req.body || {};
    log('POST /api/moviePosters/fetch', { filmId, movieGluFilmId, size_category, orientation, prefer, light });

    if (!filmId || !movieGluFilmId) {
      const e = new Error('filmId and movieGluFilmId are required');
      e.status = 400;
      throw e;
    }

    const data = await service.ingestForPoster({ filmId, movieGluFilmId, altText, size_category, orientation, prefer, light });
    log('INGEST via POST complete', { filmId, cached: data?.cached, images: data?.images?.length, ms: Date.now() - start });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    logErr('POST error', { message: err?.message, status: err?.status });
    next(err);
  }
};

// GET /api/moviePosters/:filmId
exports.listByFilmId = async (req, res, next) => {
  const start = Date.now();
  try {
    const { filmId } = req.params;
    log('GET /api/moviePosters/:filmId', { filmId });
    const posters = await service.listByFilmId(filmId);
    log('LIST posters by :filmId', { filmId, count: posters?.length || 0, ms: Date.now() - start });
    res.status(200).json({ success: true, data: posters });
  } catch (err) {
    logErr('GET :filmId error', { message: err?.message, status: err?.status });
    next(err);
  }
};
