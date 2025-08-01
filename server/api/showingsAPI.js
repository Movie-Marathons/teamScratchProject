
const headers = {
  'client': 'PERS_243',
  'x-api-key': 'WS5TTuUpZo2tEbmd9k5Y86O1BTPW29yI7EZoMFWe',
  'Authorization': 'Basic UEVSU18yNDM6OVVjT0IxZ1BpbnNx',
  'territory': 'US',
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  'Host': 'api-gate2.movieglu.com',
};

export async function getShowings(cinemaId, filmId, date,geolocation) {
  const fullHeaders = {
    ...headers,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/cinemaShowTimes/?film_id=${filmId}&cinema_id=${cinemaId}&date=${date}&sort=popularity`;

  const res = await fetch(url, { headers: fullHeaders });
  if (!res.ok) throw new Error(`Showtime API error: ${res.statusText}`);

  const data = await res.json();
  return data?.films || [];
}