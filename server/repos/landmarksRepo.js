// server/repos/landmarksRepo.js
// Data access layer for `nrhp_landmarks` (Postgres/PostGIS)

const db = require('../db');

function rowToDto(row) {
  return {
    id: row.id,
    resname: row.resname ?? row.RESNAME,
    address: row.address ?? row.Address,
    city: row.city ?? row.City,
    state: row.state ?? row.State,
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    source: row.source,
    source_id: row.source_id,
    properties: row.properties,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Find landmarks inside a bounding box (WGS84).
 * @param {{west:number,south:number,east:number,north:number,limit?:number}} params
 */
// async function findWithinBBox({ west, south, east, north, limit = 500 }) {
//   const sql = `
//     select
//       id,
//       resname,
//       address,
//       city,
//       state,
//       st_x(geom) as longitude,
//       st_y(geom) as latitude,
//       source,
//       source_id,
//       properties,
//       created_at,
//       updated_at
//     from nrhp_landmarks
//     where
//       geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
//       and ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
//     order by resname asc
//     limit $5
//   `;
//   const params = [west, south, east, north, limit];
//   const { rows } = await db.query(sql, params);
//   return rows.map(rowToDto);
// }

// ADDED BY LORENC
async function findWithinBBox({ west, south, east, north, limit = 500 }) {
  const sql = `
    SELECT
      id,
      resname  AS "RESNAME",
      address  AS "Address",
      city     AS "City",
      state    AS "State",
      ST_X(geom) AS longitude,
      ST_Y(geom) AS latitude,
      source,
      source_id,
      properties,
      created_at,
      updated_at
    FROM nrhp_landmarks
    WHERE
      geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
    ORDER BY resname ASC
    LIMIT $5
  `;
  const params = [west, south, east, north, limit];
  const { rows } = await db.query(sql, params);
  return rows.map(rowToDto);
}
async function upsertOne(clientQuery, r) {
  const sql = `
    insert into nrhp_landmarks (
      resname, address, city, state, geom, source, source_id, properties
    ) values (
      $1, $2, $3, $4,
      ST_SetSRID(ST_MakePoint($5, $6), 4326),
      coalesce($7, 'nps_nrhp'), $8, $9
    )
    on conflict on constraint uq_nrhp_landmarks_dedupe
    do update set
      address    = excluded.address,
      city       = excluded.city,
      state      = excluded.state,
      geom       = excluded.geom,
      source     = excluded.source,
      source_id  = excluded.source_id,
      properties = excluded.properties,
      updated_at = now()
    returning id, resname, address, city, state,
              ST_X(geom) as longitude, ST_Y(geom) as latitude,
              source, source_id, properties, created_at, updated_at
  `;
  const params = [
    // r.resname,
    r.address || null,
    r.city || null,
    r.state || null,
    Number(r.longitude),
    Number(r.latitude),
    r.source || 'nps_nrhp',
    r.source_id || null,
    r.properties || {},
  ];
  const { rows } = await clientQuery(sql, params);
  return rowToDto(rows[0]);
}

/**
 * Upsert an array of normalized landmark rows.
 * @param {Array<{resname:string,address?:string,city?:string,state?:string,longitude:number,latitude:number,source?:string,source_id?:string,properties?:object}>} rows
 */
async function bulkUpsert(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const saved = [];
  for (const r of rows) {
    if (
      r == null ||
      Number.isNaN(Number(r.longitude)) ||
      Number.isNaN(Number(r.latitude)) ||
      !r.resname
    ) {
      continue; // skip invalid row
    }
    const dto = await upsertOne(db.query, r);
    saved.push(dto);
  }
  return saved;
}

module.exports = {
  findWithinBBox,
  bulkUpsert,
};
