const headers = {
  client: 'PERS_243',
  'x-api-key': 'HqgZrG0lYh4poyCrqsd7Y8GABWef7ybH2HdBE8vF',
  Authorization: 'Basic UEVSU18yNDNfWFg6UmlKUHR3RWpVdjVU',
  territory: 'US',
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};

export async function getShowings(cinemaId, filmId, date, geolocation = '-22.0;14.0') {
  const fullHeaders = {
    ...headers,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/cinemaShowTimes/?film_id=${filmId}&cinema_id=${cinemaId}&date=${date}&sort=popularity`;
  const res = await fetch(url, { headers: fullHeaders });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Showtime API error: ${res.status} - ${text}`);
  }

  if (!text) {
    throw new Error('Showtime API error: Empty response body');
  }

  const data = JSON.parse(text);
  return data; // ← return the film object, not an array
}
