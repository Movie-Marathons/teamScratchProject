

const { MG_CLIENT, MG_API_KEY, MG_AUTH, MG_TERRITORY, MG_API_VERSION, MG_GEO } = process.env;

const DEFAULT_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || '8000', 10);

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

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

function redactHeaders(h) {
  const clone = { ...h };
  if (clone['x-api-key']) clone['x-api-key'] = `***${String(clone['x-api-key']).slice(-4)}`;
  if (clone.Authorization) clone.Authorization = '***redacted***';
  return clone;
}

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
  try {
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
    console.log('Debug: headers:', redactHeaders(headers));

    const url = `https://api-gate2.movieglu.com/cinemasNearby/?n=${count}`;
    const res = await fetchWithTimeout(url, { headers });

    console.log('Debug: Response status:', res.status, res.statusText);

    const text = await res.text();

    console.log('Debug: Raw response text:', text);

    if (!res.ok) {
      // Return empty on rate limit to avoid noisy stack traces upstream; service layer will handle fallback
      if (res.status === 429) {
        console.warn('Cinema API rate-limited (429). Returning empty list.');
        return [];
      }
      throw new Error(`Cinema API error: ${res.status} - ${text}`);
    }

    if (!text || !text.trim()) {
      console.warn('Cinema API warning: Empty response body');
      return [];
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('Cinema API warning: Invalid JSON, returning empty. Raw:', text?.slice(0, 200));
      return [];
    }
    return Array.isArray(data?.cinemas) ? data.cinemas : [];
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('Cinema API request timed out. Returning empty list.');
      return [];
    }
    throw err;
  }
}
