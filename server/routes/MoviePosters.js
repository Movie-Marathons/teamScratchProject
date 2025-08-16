const { buildCacheKey, getCached, setCached, invalidateByPattern } = require('../utils/cache');
const db = require('../db'); // Assumes db connection is exported from ../db
const { Router } = require('express');
const ctrl = require('../controllers/MoviePostersController.js');


const POSTERS_TTL = Number(process.env.POSTERS_TTL_SECONDS || 86400);
const router = Router();

// GET /api/moviePosters?limit=...
router.get('/',
  async (req, res, next) => {
    // If filmId is present, pass to controller (to not override existing handler)
    if (req.query.filmId) {
      return ctrl.getMoviePosters(req, res, next);
    }
    // If imdb ids are provided, return a map/list for those ids
    if (req.query.ids) {
      const raw = String(req.query.ids || "");
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (!ids.length) return res.json([]);
      // Normalize ids for a stable cache key (sort for order-insensitive hits)
      const normIds = [...ids].sort();
      const key = buildCacheKey('posters', req.path, { imdbIds: normIds });
      const cached = await getCached(key);
      if (cached) {
        return res.json(cached);
      }
      try {
        // console.log('[moviePosters:byImdbIds] ids', ids);
        const q = `
          WITH wanted AS (
            SELECT unnest($1::text[]) AS imdb_id
          )
          SELECT w.imdb_id,
                 ('data:image/jpeg;base64,' || i.image_base64) AS poster_url
          FROM wanted w
          LEFT JOIN films f ON f.imdb_title_id = w.imdb_id
          LEFT JOIN LATERAL (
            SELECT image_base64
            FROM images
            WHERE film_id = f.id
            ORDER BY id DESC NULLS LAST
            LIMIT 1
          ) i ON true;
        `;
        const { rows } = await db.query(q, [ids]);
        const map = {};
        for (const r of rows) {
          if (r && r.imdb_id && r.poster_url) map[r.imdb_id] = r.poster_url;
        }
        // Also return a stable list shape for clients that expect arrays
        const posters = ids.map((id) => ({ imdb_title_id: id, poster_url: map[id] }));
        // Invalidate other variants for this route and cache for configured TTL
        await invalidateByPattern(`posters:${req.path}:*`);
        await setCached(key, { posters, map }, POSTERS_TTL);
        return res.json({ posters, map });
      } catch (err) {
        console.error('[moviePosters:byImdbIds] query failed', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
    }
    // Otherwise, handle 'latest posters' logic
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 5;
    const keyLatest = buildCacheKey('posters:latest', req.path, { limit });
    const cachedLatest = await getCached(keyLatest);
    if (cachedLatest) {
      return res.json(cachedLatest);
    }
    try {
      console.log('[moviePosters:list] query', { limit, query: req.query });
      const result = await db.query(
        `SELECT film_id, image_base64, alt_text FROM images ORDER BY random() LIMIT $1`,
        [limit]
      );
      // Cache the latest-random selection briefly (5 minutes)
      await setCached(keyLatest, result.rows, 300);
      res.json(result.rows);
    } catch (err) {
      console.error('[moviePosters:list] error', err);
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  }
);

// GET /api/moviePosters?filmId=...

// GET /api/moviePosters/:filmId
router.get('/:filmId', (req, res, next) => {
  if (typeof ctrl.listByFilmId === 'function') {
    return ctrl.listByFilmId(req, res, next);
  }
  return res.status(501).json({ error: 'listByFilmId not implemented' });
});

// POST /api/moviePosters/fetch
router.post('/fetch', (req, res, next) => ctrl.fetchAndSavePoster(req, res, next));

module.exports = router;