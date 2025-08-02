
const headers = {
  'client': 'PERS_243',
  'x-api-key': 'WS5TTuUpZo2tEbmd9k5Y86O1BTPW29yI7EZoMFWe',
  'Authorization': 'Basic UEVSU18yNDM6OVVjT0IxZ1BpbnNx',
  'territory': 'US',
  'api-version': 'v201',
  'user-agent': 'MovieGluTestApp',
  'Host': 'api-gate2.movieglu.com',
};

export async function getFilms(cinemaId, geolocation) {
  const fullHeaders = {
    ...headers,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/filmsNowShowing/?cinema_id=${cinemaId}`;

  const res = await fetch(url, { headers: fullHeaders });
  if (!res.ok) throw new Error(`Film API error: ${res.statusText}`);

  const data = await res.json();
  return data?.films || [];
}

// (async() => { 
//   try {const result = await getFilms('48596', '40.7440;-73.9489')
//     console.log(result)
//   } catch (error) {console.log(error.message)
//     }
//   }) ();