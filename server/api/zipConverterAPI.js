async function zipToGeo(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    // console.log('Response Status:', res.status, res.statusText);
    if (!res.ok) throw new Error(`Invalid ZIP: ${zip}`);

    const data = await res.json();
    // console.log('Data:', data);
    // console.log('Places Array:', data.places);
    // console.log('First Place Object:', data.places[0]);

    const place = data?.places?.[0];
    if (!place) throw new Error(`No places found for ZIP: ${zip}`);

    // Normalize values to numbers
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);

    return { latitude, longitude };
  } catch (err) {
    console.error(`Error fetching location for ZIP ${zip}:`, err.message);
    return null;
  }
}

// (async() => { 
//   try {const result = await zipToGeo('79922');
//     console.log(result)
//   } catch (error) {console.log('Error:', error.message)
//     }
//   }) ();

// Compute bounding box for a ZIP and radius
async function zipToBBox(zip, radiusMi) {
  const geo = await zipToGeo(zip);
  if (!geo) return null;
  let { latitude, longitude } = geo;

  let r = Number(radiusMi);
  if (!r || isNaN(r)) {
    r = Number(process.env.ZIP_RADIUS_MI_DEFAULT) || 5;
  }
  const maxR = Number(process.env.ZIP_RADIUS_MI_MAX) || 20;
  if (r > maxR || r <= 0) return null;

  // Avoid divide-by-zero at poles
  const cosLat = Math.max(Math.cos(latitude * Math.PI / 180), 0.000001);
  const latDelta = r / 69;
  const lonDelta = r / (69 * cosLat);

  const west = Number((longitude - lonDelta).toFixed(6));
  const east = Number((longitude + lonDelta).toFixed(6));
  const south = Number((latitude - latDelta).toFixed(6));
  const north = Number((latitude + latDelta).toFixed(6));
  return { west, south, east, north };
}

  module.exports = { zipToGeo, zipToBBox };
//console.log(zipToGeo(79922));