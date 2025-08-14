// server/repos/cinemaRepo.js
const db = require('../db');

/**
 * Upsert many cinema rows.
 * Accepts objects shaped like either DB rows or normalized API rows.
 *
 * Column mapping:
 * - cinema_id: integer (unique key)
 * - name, postcode, city, state, address
 * - distance (double precision), latitude, longitude
 * - last_seen_at set to NOW() on write
 */
async function upsertCinemas(cinemas) {
  if (!Array.isArray(cinemas) || cinemas.length === 0) return;

  const cols = `(
    cinema_id, name, postcode, city, state, address, address2, country, distance, latitude, longitude, returned_date, last_seen_at, updated_at
  )`;

  const valuesTuples = cinemas
    .map((_, i) => {
      const o = i * 12; // 12 bound params per row; last_seen_at/updated_at are NOW()
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11}, $${o + 12}, now(), now())`;
    })
    .join(',\n');

  const queryText = `
    INSERT INTO cinemas ${cols}
    VALUES ${valuesTuples}
    ON CONFLICT (cinema_id)
    DO UPDATE SET
      name         = EXCLUDED.name,
      postcode     = EXCLUDED.postcode,
      city         = EXCLUDED.city,
      state        = EXCLUDED.state,
      address      = EXCLUDED.address,
      address2     = EXCLUDED.address2,
      country      = EXCLUDED.country,
      distance     = EXCLUDED.distance,
      latitude     = COALESCE(EXCLUDED.latitude, cinemas.latitude),
      longitude    = COALESCE(EXCLUDED.longitude, cinemas.longitude),
      returned_date= COALESCE(EXCLUDED.returned_date, cinemas.returned_date),
      last_seen_at = now(),
      updated_at   = now();
  `;

  const values = cinemas.flatMap((c) => [
    // Prefer the most explicit id fields in order
    c.cinema_id ?? c.external_id ?? c.id ?? null,
    c.name ?? null,
    c.postcode != null ? String(c.postcode) : null,
    c.city ?? null,
    c.state ?? null,
    c.address ?? null,
    c.address2 ?? null,
    c.country ?? null,
    c.distance != null ? Number(c.distance) : null,
    c.latitude != null ? Number(c.latitude) : null,
    c.longitude != null ? Number(c.longitude) : null,
    c.returned_date != null ? String(c.returned_date).slice(0, 10) : null,
  ]);

  await db.query(queryText, values);
}

/**
 * Read helpers expected by the service layer
 */
async function findByZip(zip) {
  const sql = `
    SELECT c.*
    FROM cinemas c
    WHERE c.postcode = $1
    ORDER BY c.name;
  `;
  const { rows } = await db.query(sql, [String(zip)]);
  return rows;
}

/**
 * bbox: [minLng, minLat, maxLng, maxLat]
 */
async function findByBBox(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const sql = `
    SELECT c.*
    FROM cinemas c
    WHERE c.longitude BETWEEN $1 AND $3
      AND c.latitude  BETWEEN $2 AND $4
    ORDER BY c.name;
  `;
  const { rows } = await db.query(sql, [
    Number(minLng), Number(minLat), Number(maxLng), Number(maxLat),
  ]);
  return rows;
}

/**
 * Find by coordinates within a radius (in kilometers), ordered by computed distance.
 * Note: Uses Haversine; no PostGIS dependency.
 */
async function findByCoords(lat, lon, radiusKm = 25) {
  const sql = `
    SELECT c.*,
      (6371 * acos(
        cos(radians($1))
        * cos(radians(c.latitude))
        * cos(radians(c.longitude) - radians($2))
        + sin(radians($1)) * sin(radians(c.latitude))
      )) AS calc_distance_km
    FROM cinemas c
    WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    HAVING (6371 * acos(
      cos(radians($1)) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(c.latitude))
    )) <= $3
    ORDER BY calc_distance_km ASC;
  `;
  const { rows } = await db.query(sql, [Number(lat), Number(lon), Number(radiusKm)]);
  return rows;
}

/**
 * Return the internal UUID PK for a cinema row by its external numeric id (cinema_id).
 * Returns null if not found.
 */
async function getCinemaUuidByExternalId(externalId) {
  const eid = Number(externalId);
  if (!eid || Number.isNaN(eid)) return null;

  const sql = `
    SELECT id
    FROM cinemas
    WHERE cinema_id = $1
    LIMIT 1;
  `;
  const { rows } = await db.query(sql, [eid]);
  return rows[0]?.id ?? null;
}

/**
 * Ensure there is a local row for the given external id and return its UUID.
 * Creates a minimal row when missing; updates timestamps when present.
 */
async function ensureLocalCinemaByExternalId(externalId) {
  const eid = Number(externalId);
  if (!eid || Number.isNaN(eid)) return null;

  // Fast path
  const existing = await getCinemaUuidByExternalId(eid);
  if (existing) return existing;

  const insertSql = `
    INSERT INTO cinemas (cinema_id, last_seen_at, updated_at)
    VALUES ($1, now(), now())
    ON CONFLICT (cinema_id)
    DO UPDATE SET last_seen_at = now(), updated_at = now()
    RETURNING id;
  `;
  const { rows } = await db.query(insertSql, [eid]);
  return rows[0]?.id ?? null;
}

module.exports = { upsertCinemas, findByZip, findByBBox, findByCoords, ensureLocalCinemaByExternalId, getCinemaUuidByExternalId };