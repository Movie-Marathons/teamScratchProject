const { getCinemas } = require('../api/cinemaAPI');
const { getFilms } = require('../api/filmAPI');
const { getShowings } = require('../api/showingsAPI');

async function getCinemasWithShowtimes(req, res) {
  const { zip, date, time } = req.query;

  if (!zip || !date || !time) {
    return res.status(400).json({ error: 'zip, date, and time are required' });
  }

  try {
    // Use static sandbox geolocation
    const geolocation = '-22.0;14.0';

    const cinemas = await getCinemas(geolocation);
    if (!cinemas || cinemas.length === 0) {
      return res.status(404).json({ error: 'No cinemas found near ZIP' });
    }

    const results = [];

    for (const cinema of cinemas) {
      const films = await getFilms(cinema.cinema_id, geolocation);
      const filmData = [];

      for (const film of films) {
        const showingGroups = await getShowings(cinema.cinema_id, film.film_id, date, geolocation);

        // Each film entry contains showings by format (e.g. Standard, IMAX)
        const allTimes = [];

        for (const group of showingGroups) {
          const times = group?.showings?.Standard?.times || [];
          const filtered = times.filter(t => t.start_time >= time);
          allTimes.push(...filtered);
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
