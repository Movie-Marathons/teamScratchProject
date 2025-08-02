const baseHeaders = {
  client: 'PERS_243',
  'x-api-key': 'WS5TTuUpZo2tEbmd9k5Y86O1BTPW29yI7EZoMFWe', 
  Authorization: 'Basic UEVSU18yNDM6OVVjT0IxZ1BpbnNx',      
  territory: 'US',                                           
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  Host: 'api-gate2.movieglu.com',
};

export async function getCinemas(geolocation, count = 12) {
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
