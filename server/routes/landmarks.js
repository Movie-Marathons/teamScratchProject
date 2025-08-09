

// server/routes/landmarks.js
const express = require('express');
const router = express.Router();

// Controller
const { listLandmarks, listLandmarksByZip } = require('../controllers/landMarksController');

// GET /api/landmarks
router.get('/landmarks', listLandmarks);

// GET /api/landmarks/by-zip
router.get('/landmarks/by-zip', listLandmarksByZip);

module.exports = router;