

// MoviePoster.service.js
// Service layer for movie posters: checks cache in DB, fetches from MovieGlu if needed, stores in DB.

const axios = require('axios');
const moviePosterRepo = require('../repos/moviePosterRepo');
const { getImages: mgGetImages } = require('../api/moviePosterAPI');
const { buildCacheKey, getCached, setCached } = require("../utils/cache");





// Helper: create HTTP-friendly error
function httpError(message, status = 500) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Helper: flatten and select images from MovieGlu response
function extractImageEntries(apiData, { prefer = 'poster' } = {}) {
  if (!apiData || typeof apiData !== 'object') return [];

  const groups = [];
  if (prefer === 'poster' && apiData.poster) groups.push(['poster', apiData.poster]);
  if (apiData.still) groups.push(['still', apiData.still]);
  if (prefer !== 'poster' && apiData.poster && !groups.find(g => g[0] === 'poster')) {
    groups.push(['poster', apiData.poster]);
  }

  const out = [];
  for (const [groupName, groupObj] of groups) {
    for (const refKey of Object.keys(groupObj)) {
      const item = groupObj[refKey];
      out.push({ group: groupName, ref: refKey, ...item });
    }
  }
  return out;
}

// Helper: choose best size variant
function pickSizeVariant(entry, sizePref = 'medium') {
  const order = ['XXLarge', 'XLarge', 'large', 'medium', 'small'];
  if (sizePref && entry[sizePref]) return { key: sizePref, ...entry[sizePref] };
  for (const key of order) {
    if (entry[key]) return { key, ...entry[key] };
  }
  return null;
}

// List posters from DB cache
async function listByFilmId(filmId) {
  return await moviePosterRepo.listByFilmId(filmId);
}

// Fetch posters from MovieGlu and store in DB (with caching)
async function ingestForPoster({ filmId, movieGluFilmId, altText, size_category = 'medium', orientation, prefer = 'poster' } = {}) {
  if (!filmId) throw httpError('filmId is required (UUID from films table)', 400);
  if (!movieGluFilmId) throw httpError('movieGluFilmId is required (numeric MovieGlu film_id)', 400);

  // Check cache first
  const isCached = await moviePosterRepo.existsForFilm(filmId);
  if (isCached) {
    const existing = await moviePosterRepo.listByFilmId(filmId);
    return { cached: true, film_id: filmId, images: existing };
  }

  // Fetch from MovieGlu
  let apiData;
  try {
    apiData = await mgGetImages({ film_id: movieGluFilmId, size_category, orientation });
  } catch (e) {
    throw httpError(`MovieGlu API call failed: ${e.message}`, e.status || 502);
  }

  const entries = extractImageEntries(apiData, { prefer });
  if (!entries.length) throw httpError('No images returned for this film', 404);

  // Download and store each image
  const saved = [];
  for (const entry of entries) {
    const chosen = pickSizeVariant(entry, size_category);
    if (!chosen || !chosen.film_image) continue;

    try {
      const resp = await axios.get(chosen.film_image, { responseType: 'arraybuffer' });
      const image_base64 = Buffer.from(resp.data).toString('base64');
      const derivedAlt = altText || [
        entry.group === 'poster' ? 'Poster' : 'Still',
        entry.region ? `(${entry.region})` : '',
        entry.image_orientation ? `- ${entry.image_orientation}` : '',
        chosen.key ? ` ${chosen.key}` : ''
      ].join(' ').trim().replace(/\s+/g, ' ');

      const row = await moviePosterRepo.createPoster({
        film_id: filmId,
        image_base64,
        alt_text: derivedAlt
      });
      saved.push(row);
    } catch {
      continue; // Skip if download fails
    }
  }

  if (!saved.length) throw httpError('Images found but none could be saved', 502);

  return { cached: false, film_id: filmId, images: saved };
}

module.exports = {
  ingestForPoster,
  listByFilmId
};