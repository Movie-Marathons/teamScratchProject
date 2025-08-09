// server/repos/cinemaRepo.js
const db = require('../db');

async function upsertCinemas(cinemas) {
  if (!Array.isArray(cinemas) || cinemas.length === 0) return;

  const queryText = `
    INSERT INTO cinemas (
      cinema_id, name, postcode, city, state, address, distance, latitude, longitude, last_seen_at
    )
    VALUES 
      ${cinemas.map(
        (_, i) => `($${i * 9 + 1}, $${i * 9 + 2}, $${i * 9 + 3}, $${i * 9 + 4}, $${i * 9 + 5}, $${i * 9 + 6}, $${i * 9 + 7}, $${i * 9 + 8}, $${i * 9 + 9}, now())`
      ).join(',\n')}
    ON CONFLICT (cinema_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      postcode = EXCLUDED.postcode,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      address = EXCLUDED.address,
      distance = EXCLUDED.distance,
      latitude = COALESCE(EXCLUDED.latitude, cinemas.latitude),
      longitude = COALESCE(EXCLUDED.longitude, cinemas.longitude),
      last_seen_at = now(),
      updated_at = now()
  `;

  const values = cinemas.flatMap(c => [
    c.id,
    c.name,
    c.postcode?.toString() ?? null,
    c.city ?? null,
    c.state ?? null,
    c.address ?? null,
    Number(c.distance) ?? null,
    Number(c.latitude) || null,
    Number(c.longitude) || null,
  ]);

  await db.query(queryText, values);
}

module.exports = { upsertCinemas };