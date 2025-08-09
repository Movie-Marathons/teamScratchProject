// const headers = {
//   client: 'PERS_243',
//   'x-api-key': 'HqgZrG0lYh4poyCrqsd7Y8GABWef7ybH2HdBE8vF',
//   Authorization: 'Basic UEVSU18yNDNfWFg6UmlKUHR3RWpVdjVU',
//   territory: 'XX',
//   'api-version': 'v201',
//   'user-agent': 'MovieGluTestApp',
//   Host: 'api-gate2.movieglu.com',
// };

const baseHeaders = {
  client: 'APPS_0',
  'x-api-key': 'hRo2RN8OQa2HIkdNW5XnQ7s4qsfYcFn3ooJ6opdc', 
  Authorization: 'Basic QVBQU18wOkZ1VE5zZktBY0t3UQ',      
  territory: 'US',                                           
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};

export async function getFilms(cinemaId, geolocation = '-22.0;14.0') {
  const fullHeaders = {
    ...headers,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/filmsNowShowing/?cinema_id=${cinemaId}`;
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
