const { getCinemas } = require('../api/cinemaAPI copy');
const { getFilms } = require('../api/filmAPI copy');
const { getShowings } = require('../api/showingsAPI copy');
const { zipToGeo } = require('../api/zipConverterAPI copy');

async function getCinemasWithShowtimes(req, res) {
  const { zip, date, time } = req.query;

  if (!zip || !date || !time) {
    return res.status(400).json({ error: 'zip, date, and time are required' });
  }

  try {
    // Resolve real geolocation
    const geo = await zipToGeo(zip);
    if (!geo || !geo.latitude || !geo.longitude) {
      return res.status(404).json({ error: 'Could not resolve ZIP to geolocation' });
    }

    const geolocation = `${geo.latitude};${geo.longitude}`;
    
    const cinemas = await getCinemas(geolocation);
    if (!cinemas || cinemas.length === 0) {
      return res.status(404).json({ error: 'No cinemas found near ZIP' });
    }

    const results = [];

    for (const cinema of cinemas) {
      const films = await getFilms(cinema.cinema_id, geolocation);
      const filmData = [];

      for (const film of films) {
        const showingData = await getShowings(cinema.cinema_id, film.film_id, date, geolocation);

        const allTimes = [];

        // Real API may have multiple format groups under .showings
        for (const group of showingData) {
          const showingsObj = group?.showings || {};
          for (const format in showingsObj) {
            const times = showingsObj[format]?.times || [];
            const filtered = times.filter(t => t.start_time >= time);
            allTimes.push(...filtered);
          }
        }

        if (allTimes.length > 0) {
          filmData.push({
            film_id: film.film_id,
            title: film.film_name,
            showtimes: allTimes.map(s => ({
              start: s.start_time,
              end: s.end_time
            }))
          });
        }
      }

      if (filmData.length > 0) {
        results.push({
          cinema: {
            cinema_id: cinema.cinema_id,
            cinema_name: cinema.cinema_name,
            address: cinema.address,
            city: cinema.city,
            state: cinema.state,
            postcode: cinema.postcode,
            show_dates: [
              {
                date,
                display_date: new Date(date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })
              }
            ]
          },
          films: filmData
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error in getCinemasWithShowtimes:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getCinemasWithShowtimes };
