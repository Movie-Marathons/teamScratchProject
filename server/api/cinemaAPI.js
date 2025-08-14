
const { MG_CLIENT, MG_API_KEY, MG_AUTH, MG_TERRITORY, MG_API_VERSION, MG_GEO } = process.env;

//Good Headers
// const baseHeaders = {
//   client: 'APPS_0',
//   'x-api-key': 'hRo2RN8OQa2HIkdNW5XnQ7s4qsfYcFn3ooJ6opdc', 
//   Authorization: 'Basic QVBQU18wOkZ1VE5zZktBY0t3UQ',      
//   territory: 'US',                                           
//   'api-version': 'v201',
//   'user-agent': 'MovieGluTestApp',
//   Host: 'api-gate2.movieglu.com',
// };
// require('dotenv').config();
const baseHeaders = {
  client: process.env.MG_CLIENT || '',
  'x-api-key': process.env.MG_API_KEY || '',
  Authorization: process.env.MG_AUTH || '',
  territory: process.env.MG_TERRITORY || 'US',
  'api-version': process.env.MG_API_VERSION || 'v201',
  'user-agent': process.env.MG_USER_AGENT || 'MovieGluTestApp',
  Accept: 'application/json',
};

//Sandobx Headers
// const baseHeaders = {
//   client: 'APPS_0',
//   'x-api-key': '9NEmbAPR7Pa2FhIrbgJpM52aNm0TuDVa9zRQLxyu', 
//   Authorization: 'Basic QVBQU18wX1hYOldXMzJZeUVuQUFtZA',      
//   territory: 'XX',                                           
//   'api-version': 'v201',
//   'user-agent': 'MovieGluTestApp',
//   Host: 'api-gate2.movieglu.com',
// };

export async function getCinemas(geolocation = '-22.0;14.0', count = 5) {
  const geoString =
    typeof geolocation === 'string'
      ? geolocation
      : `${geolocation.latitude.toFixed(4)};${geolocation.longitude.toFixed(4)}`;
  const headers = {
    ...baseHeaders,
    geolocation: geoString,
    'device-datetime': new Date().toISOString().split('.')[0] + 'Z',
  };

  console.log('Debug: geoString:', geoString);
  console.log('Debug: headers:', headers);

  const url = `https://api-gate2.movieglu.com/cinemasNearby/?n=${count}`;
  const res = await fetch(url, { headers });

  console.log('Debug: Response status:', res.status, res.statusText);

  const text = await res.text();

  console.log('Debug: Raw response text:', text);

  if (!res.ok) {
    throw new Error(`Cinema API error: ${res.status} - ${text}`);
  }

  if (!text) {
    throw new Error('Cinema API error: Empty response body');
  }

  const data = JSON.parse(text);
  return data?.cinemas || [];
}
