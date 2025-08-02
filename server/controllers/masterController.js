// importing functions
const { zipToGeo } = require('../api/zipConverterAPI');
const { getCinemas } = require('../api/cinemaAPI');
const { getFilms } = require('../api/filmAPI');
const { getShowings } = require('../api/showingsAPI');

//overall function - 
// inputs : req, res
// outputs: json with cinemas/shows, sourced from getCinemas, get Films, getShowings
async function getCinemasWithShowtimes(req, res) {
  //destructuring zip, date,time inputs from frontend, getting them from our query (which needs to be setup)
  const { zip, date, time } = req.query;

  //if any of the inputs are empty we return status 400 with error
  if (!zip || !date || !time) {
    return res.status(400).json({ error: 'zip, date, and time are required' });
  }

  //try block
  try {
    //storing geolocation, if unsuccesful, return 404 error
    const geolocation = await zipToGeo(zip);
    if (!geolocation) {
      return res.status(404).json({ error: 'Could not resolve ZIP to location' });
    }

    //call getCinemas, using geolocation constant as parameter
    const cinemas = await getCinemas(geolocation);
    //errorhandling for no data, respond 404 error
    if (!cinemas || cinemas.length === 0) {
      return res.status(404).json({ error: 'No cinemas found near ZIP' });
    }

    //results initialized to empty array
    const results = [];

    // for of loop to iterate through each cinema key of our cinemas object
    for (const cinema of cinemas) {
      //calling films for each cinema that exists in our json, cinema.id and geolocation are params
      const films = await getFilms(cinema.cinema_id, geolocation);
      //initialize empty array filmData
      const filmData = [];

      //embedded for of loop - calling getShowings to save every single showing for every film for every cinema
      for (const film of films) {
        const showings = await getShowings(cinema.cinema_id, film.film_id, date, geolocation);

        // Only include films with at least one showtime
        if (showings.length > 0) {
          // popularing our film data array with id, title, showtimes (mapping start and end times);
          filmData.push({
            film_id: film.film_id,
            title: film.film_name,
            showtimes: showings.map(s => ({
              start: s.start_time,
              end: s.end_time
            }))
          });
        }
      }

      //populating our results array with cinema, titles, showtimes, everything 
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

    //return our results as a json response
    res.json(results);
  } catch (err) {
    // basic catch return 500 error
    console.error('Error in getCinemasWithShowtimes:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

//exprting function for frontend to call and receive all json data
module.exports = { getCinemasWithShowtimes };
