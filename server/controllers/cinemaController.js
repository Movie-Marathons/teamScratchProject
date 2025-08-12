// controllers/cinemaController.js
const cinemaService = require('../services/cinema.service.js');

async function getCinemasByZipController(req, res, next) {
  const { zip } = req.query;
  if (!zip) {
    return res.status(400).json({ error: 'zip is required' });
  }

  try {
    const cinemas = await cinemaService.getByZip(zip);
    res.json({ zip, cinemas });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCinemasByZipController };