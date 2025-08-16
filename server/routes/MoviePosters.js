const db = require('../db'); // Assumes db connection is exported from ../db
const { Router } = require('express');
const ctrl = require('../controllers/MoviePostersController.js');

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
      try {
        console.log('[moviePosters:byImdbIds] ids', ids);
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
        return res.json({ posters, map });
      } catch (err) {
        console.error('[moviePosters:byImdbIds] query failed', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
    }
    // Otherwise, handle 'latest posters' logic
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 5;
    try {
      console.log('[moviePosters:list] query', { limit, query: req.query });
      const result = await db.query(
        `SELECT film_id, image_base64, alt_text FROM images ORDER BY random() LIMIT $1`,
        [limit]
      );
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