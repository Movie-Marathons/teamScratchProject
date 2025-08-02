
const baseHeaders = {
'client': 'CODE_16', 
'x-api-key': 'KidUK6LrNB2M2rptqwrlN1FPATBwSM0T1NFPFbqr', 
'authorization': 'Basic Q09ERV8xNjpwc3VnMFdGdEdhR1Y=',
'territory': 'US', 
'api-version': 'v201',
'user-agent': 'MovieGluTestApp',
Host: 'api-gate2.movieglu.com',
};

async function getCinemas(geolocation, count = 12) {
  const headers = {
    ...baseHeaders,
    geolocation,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/cinemasNearby/?n=${count}`;

  const res = await fetch(url, { headers });
  const rawText = await res.text();
  // console.log('Raw response from cinemasNearby:', rawText);
  if (!res.ok) throw new Error(`Cinema API error (${res.status}): ${rawText}`);

let data;
try {
  data = JSON.parse(rawText);
} catch (err) {
  throw new Error(`Invalid JSON returned from cinemasNearby: ${rawText}`);
}

return data?.cinemas || [];
  // const data = await res.json();
  // console.log(data);
  // return data?.cinemas || [];
}

module.exports = { getCinemas };
// console.log(getCinemas('40.7440;-73.9489'))