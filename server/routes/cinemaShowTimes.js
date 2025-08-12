const express = require('express');
const router = express.Router();
const { getCinemasShowTimes } = require('../controllers/cinemaShowTimesController.js');

// GET /cinemaShowTimes
// Expects query parameters: cinemaExternalId, dateISO, showDateId
router.get('/', getCinemasShowTimes);

module.exports = router;