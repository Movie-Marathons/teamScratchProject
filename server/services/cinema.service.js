
const cinemaRepo = require('../repos/cinemaRepo');
const { getCinemas } = require('../api/cinemaAPI');
const { zipToGeo } = require('../api/zipConverterAPI');
const { buildCacheKey, getCached, setCached } = require("../utils/cache");

const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL !== '0' && process.env.ALLOW_EXTERNAL !== 'false';

const DB_HIT_THRESHOLD = 1;




/**
 * Convert DB rows to a plain array (no GeoJSON).
 */
function rowsToArray(rows) {
  return (rows || []).map(r => ({ ...r }));
}

/**
 * Get cinemas by ZIP code, using DB cache and falling back to MovieGlu API.
 */
async function getByZip(zip) {
  // Check DB first
  const dbRows = await cinemaRepo.findByZip(zip);
  if (dbRows && dbRows.length >= DB_HIT_THRESHOLD) {
    return rowsToArray(dbRows);
  }
  // Not enough data, optionally fetch from MovieGlu using geolocation from ZIP
  if (!ALLOW_EXTERNAL) {
    // External calls disabled (e.g., to avoid rate limits during dev). Return DB data as-is.
    return rowsToArray(dbRows);
  }

  let geo;
  try {
    geo = await zipToGeo(zip);
  } catch (e) {
    console.warn('[cinema.service] zipToGeo failed, falling back to DB-only:', e?.message || e);
    return rowsToArray(dbRows);
  }

  if (!geo?.latitude || !geo?.longitude) {
    // If we can't resolve ZIP, just return what we had (even if empty)
    return rowsToArray(dbRows);
  }

  const geolocation = `${geo.latitude};${geo.longitude}`;

  try {
    const apiResponse = await getCinemas(geolocation);
    const normalized = (apiResponse || []).map(c => ({
      external_id: c.cinema_id,
      name: c.cinema_name,
      postcode: c.postcode || zip,
      distance: c.distance,
      city: c.city,
      state: c.state,
      address: c.address,
      latitude: c.lat || c.latitude,
      longitude: c.lng || c.lon || c.longitude,
      zip,
      source: 'movieglu'
    }));

    if (normalized.length > 0) {
      await cinemaRepo.upsertCinemas(normalized);
      return rowsToArray(normalized);
    }

    // If external also empty, just return what we had (possibly empty)
    return rowsToArray(dbRows);
  } catch (e) {
    // Swallow external errors (e.g., 429/500) and serve DB results to keep frontend stable
    console.warn('[cinema.service] getCinemas failed or rate-limited, falling back to DB-only:', e?.message || e);
    return rowsToArray(dbRows);
  }
}

/**
 * Optionally, get cinemas by bounding box (for map queries).
 * bbox: [minLng, minLat, maxLng, maxLat]
 */
async function getByBBox(bbox) {
  // Check DB for cinemas within bbox
  const dbRows = await cinemaRepo.findByBBox(bbox);
  if (dbRows && dbRows.length >= DB_HIT_THRESHOLD) {
    return rowsToArray(dbRows);
  }
  // Optionally, could fetch from API if needed (not all APIs support this)
  // For now, just return DB results (even if empty)
  return rowsToArray(dbRows);
}

module.exports = {
  getByZip,
  getByBBox,
};