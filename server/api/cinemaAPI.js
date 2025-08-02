const baseHeaders = {
  client: 'PERS_243',
  'x-api-key': 'HqgZrG0lYh4poyCrqsd7Y8GABWef7ybH2HdBE8vF',
  Authorization: 'Basic UEVSU18yNDNfWFg6UmlKUHR3RWpVdjVU',
  territory: 'XX',
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};

export async function getCinemas(geolocation = '-22.0;14.0', count = 12) {
  const headers = {
    ...baseHeaders,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/cinemasNearby/?n=${count}`;
  const res = await fetch(url, { headers });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Cinema API error: ${res.status} - ${text}`);
  }

  if (!text) {
    throw new Error('Cinema API error: Empty response body');
  }

  const data = JSON.parse(text);
  return data?.cinemas || [];
}
