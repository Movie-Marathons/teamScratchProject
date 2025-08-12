// server/api/landMarks.js
const axios = require('axios');

const BASE_URL =
  process.env.NPS_NRHP_BASE_URL ||
  'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';

const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);

function buildUrl(base, params) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '')
      u.searchParams.set(k, String(v));
  });
  return u.toString();
}

function sanitizeFields(fields) {
  if (!fields) return ['RESNAME', 'Address', 'City', 'State'];
  const arr = Array.isArray(fields) ? fields : String(fields).split(',');
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

/**
 * Fetch NRHP landmarks within a bounding box.
 * @param {{
 *   west:number, south:number, east:number, north:number,
 *   where?: string,
 *   outFields?: string[] | string,
 *   returnGeometry?: boolean,
 *   limit?: number,
 *   offset?: number
 * }} opts
 * @returns {Promise<any>} GeoJSON FeatureCollection
 */
async function getLandmarks(opts) {
  const {
    west,
    south,
    east,
    north,
    where = '1=1',
    outFields = '*', //* to default to //['RESNAME', 'Address', 'City', 'State'], // expected from the front end
    returnGeometry = true,
    limit,
    offset,
  } = opts || {};

  const fields = sanitizeFields([
    ...outFields,
    'RESNAME',
    'Address',
    'City',
    'State',
  ]);

  const params = {
    where,
    geometry: `${west},${south},${east},${north}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
    outFields: fields.join(','),
    returnGeometry: String(returnGeometry),
    f: 'geojson',
  };

  // DEBUGING TESTS

  // // after destructuring opts:
  // const fields = sanitizeFields([
  //   ...(Array.isArray(outFields) ? outFields : [outFields]),
  //   'RESNAME',
  //   'Address',
  //   'City',
  //   'State', // make sure they're always requested
  // ]);

  // const params = {
  //   where,
  //   geometry: `${west},${south},${east},${north}`,
  //   geometryType: 'esriGeometryEnvelope',
  //   inSR: 4326,
  //   spatialRel: 'esriSpatialRelIntersects',
  //   outFields: fields.join(','),
  //   returnGeometry: String(returnGeometry),
  //   f: 'geojson',
  // };

  // const url = buildUrl(BASE_URL, params);
  // console.log('[NPS] URL:', url); // TEMP: remove later

  if (typeof limit === 'number') params.resultRecordCount = Math.max(1, limit);
  if (typeof offset === 'number') params.resultOffset = Math.max(0, offset);

  const url = buildUrl(BASE_URL, params);

  try {
    const { data } = await axios.get(url, {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        'User-Agent': 'movie-marathon-backend/1.0',
        Accept: 'application/geo+json, application/json',
      },
    });
    return data; // GeoJSON FeatureCollection
  } catch (err) {
    // Let upstream error handler format this
    err.message = `ArcGIS NRHP request failed: ${err.message}`;
    throw err;
  }
}

module.exports = { getLandmarks };
