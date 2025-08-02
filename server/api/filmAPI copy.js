const headers = {
  client: 'PERS_243',
  'x-api-key': 'WS5TTuUpZo2tEbmd9k5Y86O1BTPW29yI7EZoMFWe', 
  Authorization: 'Basic UEVSU18yNDM6OVVjT0IxZ1BpbnNx',     
  territory: 'US',                                          
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};

export async function getFilms(cinemaId, geolocation, n = 1) {
  const fullHeaders = {
    ...headers,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/filmsNowShowing/?n=${n}&cinema_id=${cinemaId}`;
  const res = await fetch(url, { headers: fullHeaders });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Film API error: ${res.status} - ${text}`);
  }

  if (!text) {
    throw new Error('Film API error: Empty response body');
  }

  const data = JSON.parse(text);
  return data?.films || [];
}
