const fetch = require('node-fetch');

const headers = {
  'client': 'PERS_243',
  'x-api-key': 'WS5TTuUpZo2tEbmd9k5Y86O1BTPW29yI7EZoMFWe',
  'Authorization': 'Basic UEVSU18yNDM6OVVjT0IxZ1BpbnNx',
  'territory': 'US',
  'api-version': 'v201',
  'geolocation': '40.7440;-73.9489',
  'device-datetime': new Date().toISOString(),
  'user-agent': 'MovieGluTestApp',
  'Host': 'api-gate2.movieglu.com',
};

const testFullChain = async () => {
  try {
    // Get nearby cinemas /cinemasNearby , ?n for number of cinemas
    const cinemaRes = await fetch('https://api-gate2.movieglu.com/cinemasNearby/?n=1', { headers });
    const cinemaData = await cinemaRes.json();
    const cinema = cinemaData.cinemas?.[0]; 

    if (!cinema) {
      console.error('No cinemas found');
      return;
    }

    console.log(`Found cinema: ${cinema.cinema_name} (ID: ${cinema.cinema_id})`);

    // Get films showing at that cinema using cinema ID
    const filmsUrl = `https://api-gate2.movieglu.com/filmsNowShowing/?cinema_id=${cinema.cinema_id}`;
    const filmRes = await fetch(filmsUrl, { headers });
    const filmData = await filmRes.json();
    const film = filmData.films?.[0];

    if (!film) {
      console.error('No films found');
      return;
    }

    console.log(`Found film: ${film.film_name} (ID: ${film.film_id})`);

    // Get showtimes using films_id and cinema_id
    const showtimeUrl = `https://api-gate2.movieglu.com/cinemaShowTimes/?film_id=${film.film_id}&cinema_id=${cinema.cinema_id}&date=2025-07-30&sort=popularity`;
    const showtimeRes = await fetch(showtimeUrl, { headers });
    const showtimeData = await showtimeRes.json();

    console.log('Showtimes:', JSON.stringify(showtimeData, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
};

testFullChain();
