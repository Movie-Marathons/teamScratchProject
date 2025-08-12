const express = require('express');
const router = express.Router();
const { getCinemasByZipController } = require('../controllers/cinemaController');

// GET /cinemas?zip=...
router.get('/', getCinemasByZipController);

module.exports = router;