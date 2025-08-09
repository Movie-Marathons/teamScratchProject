// server/utils/landmarks.normalize.js

/**
 * Normalize a single GeoJSON Feature from the NPS NRHP API into a DB-ready row.
 * @param {Object} feature - GeoJSON Feature
 * @returns {Object|null} normalized object or null if invalid
 */
function normalizeGeoJsonFeature(feature) {
  if (!feature || feature.type !== 'Feature') return null;
  const props = feature.properties || {};
  const geom = feature.geometry || {};
  if (geom.type !== 'Point' || !Array.isArray(geom.coordinates)) return null;
  const [lon, lat] = geom.coordinates;

  return {
    resname: props.RESNAME || null,
    address: props.Address || null,
    city: props.City || null,
    state: props.State || null,
    longitude: Number(lon),
    latitude: Number(lat),
    source: 'nps_nrhp',
    source_id: null, // NPS doesn't provide a stable ID in this feed
    properties: props
  };
}

/**
 * Normalize a GeoJSON FeatureCollection into an array of DB-ready rows.
 * @param {Object} collection - GeoJSON FeatureCollection
 * @returns {Array<Object>} array of normalized objects
 */
function normalizeGeoJsonCollection(collection) {
  if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return [];
  }
  return collection.features
    .map(normalizeGeoJsonFeature)
    .filter(Boolean);
}

module.exports = {
  normalizeGeoJsonFeature,
  normalizeGeoJsonCollection
};
