//const { getTheaterData, getNearbyTheaters } = require('../api/cinemaAPI');
const { getCinemas } = require('../api/cinemaAPI');
//const { getMoviesForTheater } = require('../api/filmAPI');
const { getFilms } = require('../api/filmAPI');
// const { getShowtimesForMovie } = require('../api/showingsAPI');
const { getShowings } = require('../api/showingsAPI');
const { zipToGeo } = require('../api/zipConverterAPI.js');

//const { buildSchedules } = require('../utilities/schedulingAlgo');

async function getDailyScheduleOptions(req, res) {

  try {
    let { theaterId, date, zip } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Missing date' });
    }

    //ZIP-based theater search
    if (!theaterId && zip) {
      const geo = await zipToGeo(zip);
      const nearbyTheaters = await getCinemas(geo.lat, geo.lng);
        console.log('Geo:', geo);
        console.log('Nearby Theaters:', nearbyTheaters);
      if (!nearbyTheaters || nearbyTheaters.length === 0) {
        return res.status(404).json({ error: 'No theaters found for ZIP' });
      }

      //Return theater list so client can choose one
      return res.json({
        date,
        theaters: nearbyTheaters
      });
    }

    //Schedule flow (requires theaterId)
    if (!theaterId) {
      return res.status(400).json({ error: 'Missing theaterId or valid zip' });
    }

    const theater = await getCinemas(theaterId);

    const movies = await getFilms(theaterId, date);

    const movieShowtimes = [];
    for (const movie of movies) {
      const timeRanges = await getShowings(theaterId, movie.id, date);
      const normalizedTimes = timeRanges.map(t => ({
        start: t.start_time,
        end: t.end_time
      }));
      
      movieShowtimes.push({
        title: movie.title,
        showtimes: normalizedTimes
      });
    }

    const scheduleOptions = movieShowtimes;

    res.json({
      theater,
      date,
      scheduleOptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

// console.log('Theater:', theater);
// console.log('Movies:', movies);

module.exports = { getDailyScheduleOptions };
