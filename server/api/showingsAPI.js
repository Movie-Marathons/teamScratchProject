
const headers = {
'client': 'CODE_16', 
'x-api-key': 'KidUK6LrNB2M2rptqwrlN1FPATBwSM0T1NFPFbqr', 
'authorization': 'Basic Q09ERV8xNjpwc3VnMFdGdEdhR1Y=',
'territory': 'US', 
'api-version': 'v201',
'user-agent': 'MovieGluTestApp',
Host: 'api-gate2.movieglu.com',
};
async function getShowings(cinemaId, filmId, date,geolocation) {
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

module.exports = { getShowings };
// (async() => { 
//   try {const result = await getShowings('48596', '338995', '2025-08-20', '40.7440;-73.9489')
//     console.log(result)
//   } catch (error) {console.log('Error:', error.message)
//     }
//   }) ();