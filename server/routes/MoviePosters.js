const { Router } = require('express');
const ctrl = require('../controllers/MoviePostersController.js');

const router = Router();

// GET /api/moviePosters?filmId=...
router.get('/', (req, res, next) => ctrl.getMoviePosters(req, res, next));

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