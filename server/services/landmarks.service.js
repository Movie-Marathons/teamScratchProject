const landmarksRepo = require('../repos/landmarksRepo');
const landMarksApi = require('../api/landMarks');
const normalize = require('../utils/landmarks.normalize');
const zipConverterAPI = require('../api/zipConverterAPI');
const { buildCacheKey, getCached, setCached } = require("../utils/cache");

const DB_HIT_THRESHOLD = process.env.DB_HIT_THRESHOLD
  ? parseInt(process.env.DB_HIT_THRESHOLD, 10)
  : 1;




  
// function rowsToFeatureCollection(rows) {
//   return {
//     type: 'FeatureCollection',
//     features: rows.map((row) => ({
//       type: 'Feature',
//       geometry: {
//         type: 'Point',
//         coordinates: [row.longitude, row.latitude],
//       },
//       properties: {
//         RESNAME: row.RESNAME,
//         Address: row.Address,
//         City: row.City,
//         State: row.State,
//       },
//     })),
//   };
// }

//DEBUGIN
function rowsToFeatureCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map((row, i) => {
      const RESNAME = row.resname ?? row.RESNAME ?? row.res_name ?? 'Unknown';
      const Address = row.address ?? row.Address ?? '';
      const City = row.city ?? row.City ?? '';
      const State = row.state ?? row.State ?? '';

      const lon = Number(row.longitude ?? row.lon ?? row.lng);
      const lat = Number(row.latitude ?? row.lat);

      return {
        type: 'Feature',
        id: row.id ?? i,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { RESNAME, Address, City, State },
      };
    }),
  };
}
//////

async function getByBBox({ west, south, east, north, limit }) {
  const rows = await landmarksRepo.findWithinBBox({
    west,
    south,
    east,
    north,
    limit,
  });
  if (rows.length >= DB_HIT_THRESHOLD) {
    console.log('DB hit: returning landmarks from database');
    return rowsToFeatureCollection(rows);
  } else {
    console.log('DB miss: fetching landmarks from API');
    const apiGeoJson = await landMarksApi.getLandmarks({
      west,
      south,
      east,
      north,
      limit,
    });
    const normalized = normalize.normalizeGeoJsonCollection(apiGeoJson);
    await landmarksRepo.bulkUpsert(normalized);
    return apiGeoJson;
  }
}

async function getByZip({ zip, radiusMi, limit }) {
  const bbox = await zipConverterAPI.zipToBBox(zip, radiusMi);
  return getByBBox({ ...bbox, limit });
}

module.exports = {
  getByBBox,
  getByZip,
};
