const headers = {
'client': 'CODE_16', 
'x-api-key': 'KidUK6LrNB2M2rptqwrlN1FPATBwSM0T1NFPFbqr', 
'authorization': 'Basic Q09ERV8xNjpwc3VnMFdGdEdhR1Y=',
'territory': 'US', 
'api-version': 'v201',
'user-agent': 'MovieGluTestApp',
Host: 'api-gate2.movieglu.com',
};

async function getFilms(cinemaId, geolocation) {
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

module.exports = { getFilms };
// (async() => { 
//   try {const result = await getFilms('48596', '40.7440;-73.9489')
//     console.log(result)
//   } catch (error) {console.log(error.message)
//     }
//   }) ();