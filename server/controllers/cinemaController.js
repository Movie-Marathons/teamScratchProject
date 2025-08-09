// controllers/cinemaController.js
const { zipToGeo } = require('../api/zipConverterAPI');
const { getCinemas } = require('../api/cinemaAPI');
const { upsertCinemas } = require('../repos/cinemaRepo');

async function listCinemas(req, res) {
  const { zip } = req.query;
  const { lat, lon, lng } = req.query;
  if (!zip && !(lat && (lon || lng))) {
    return res.status(400).json({ error: 'Provide either zip or lat & lon/lng' });
  }

  try {
    // Allow direct lat/lon overrides for debugging or client-provided coords
    let geolocation;
    if (lat && (lon || lng)) {
      const useLon = lon ?? lng;
      geolocation = `${lat};${useLon}`;
      console.log('Using direct geolocation from query:', geolocation);
    } else {
      const geo = await zipToGeo(zip);
      console.log('zipToGeo result for', zip, ':', geo);
      if (!geo?.latitude || !geo?.longitude) {
        return res.status(404).json({ error: 'Could not resolve ZIP to geolocation' });
      }
      geolocation = `${geo.latitude};${geo.longitude}`;
    }

    console.log('Fetching cinemas for geolocation:', geolocation);
    const cinemas = await getCinemas(geolocation);
    console.log('Cinemas received:', Array.isArray(cinemas) ? cinemas.length : 'n/a');

    // keep it light
    const out = (cinemas || []).map(c => ({
      id: c.cinema_id,
      name: c.cinema_name,
      postcode: c.postcode,
      distance: c.distance,
      city: c.city,
      state: c.state,
      address: c.address,
    }));

    // Save to DB with normalized shape
    await upsertCinemas(out);

    res.json(out);
  } catch (err) {
    console.error('listCinemas error:', err?.message || err);
    res.status(502).json({ error: 'Cinema lookup failed' });
  }
}

module.exports = { listCinemas };