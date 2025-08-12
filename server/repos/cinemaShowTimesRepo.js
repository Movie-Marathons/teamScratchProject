// server/repos/cinemaShowTimesRepo.js
// Repo focused on persisting data derived from MovieGlu *cinemaShowTimes* responses.
const db = require('../db');

/**
 * Normalize films from a MovieGlu cinemaShowTimes payload.
 * Only extracts fields we actually persist to the `films` table.
 *
 * Expected MovieGlu shape excerpt:
 * {
 *   "cinema": { "cinema_id": 8941, "cinema_name": "..." },
 *   "films": [
 *     {
 *       "film_id": 227902,
 *       "imdb_id": 3829266,                // (deprecated by MovieGlu but often present)
 *       "imdb_title_id": "tt3829266",
 *       "film_name": "The Predator",
 *       "synopsis": "optional...",
 *       "duration_mins": 107,
 *       "version_type": "Standard",
 *       "age_rating": [...],
 *       "film_image": "https://..."
 *       // showings, formats, etc...
 *     }
 *   ]
 * }
 */
function normalizeMovieGluFilms(payload) {
  if (!payload || !Array.isArray(payload.films)) return [];

  return payload.films.map((f) => ({
    imdb_id: f.imdb_id != null ? Number(f.imdb_id) : null,
    imdb_title_id: f.imdb_title_id ?? null,
    name: f.film_name ?? null,
    synopsis: f.synopsis ?? null,
    duration_mins: f.duration_mins != null ? Number(f.duration_mins) : null,
    version_type: f.version_type ?? null,
  }));
}

/**
 * Upsert many film rows derived from a MovieGlu cinemaShowTimes response.
 *
 * Assumptions:
 * - You have (or will add) a UNIQUE index on films.imdb_title_id for clean upserts
 *   (recommended since MovieGlu provides imdb_title_id consistently).
 *   If you do not have that unique index yet, switch to a SELECT-then-UPDATE fallback.
 */
async function upsertFilmsFromShowtimesResponse(payload) {
  const films = normalizeMovieGluFilms(payload);
  if (films.length === 0) return { inserted: 0, updated: 0 };

  const cols = `(imdb_id, imdb_title_id, name, synopsis, duration_mins, version_type, updated_at)`;
  const valuesTuples = films
    .map((_, i) => {
      const o = i * 6; // 6 bound params per row; updated_at handled via param list
      // ($1..$6, now())
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, now())`;
    })
    .join(',\n');

  const queryText = `
    INSERT INTO films ${cols}
    VALUES
    ${valuesTuples}
    ON CONFLICT (imdb_title_id)
    DO UPDATE SET
      imdb_id       = EXCLUDED.imdb_id,
      name          = EXCLUDED.name,
      synopsis      = EXCLUDED.synopsis,
      duration_mins = EXCLUDED.duration_mins,
      version_type  = EXCLUDED.version_type,
      updated_at    = now()
    RETURNING xmax = 0 AS inserted; -- inserted=true when tuple is new
  `;

  const values = films.flatMap((f) => [
    f.imdb_id,
    f.imdb_title_id,
    f.name,
    f.synopsis,
    f.duration_mins,
    f.version_type,
  ]);

  const { rows } = await db.query(queryText, values);
  const inserted = rows.filter((r) => r.inserted).length;
  const updated = rows.length - inserted;
  return { inserted, updated };
}

/**
 * (Step 2 placeholder)
 * We'll wire showtimes upserts once you confirm the target table/columns.
 * Suggested minimal table: cinema_showtimes
 *   - id UUID PK (default gen_random_uuid())
 *   - cinema_id INT NOT NULL
 *   - film_imdb_title_id TEXT NULL (or film_id UUID FK if you prefer strict FK)
 *   - starts_at TIMESTAMPTZ NOT NULL
 *   - version_type TEXT NULL
 *   - attributes JSONB NULL  (3D/IMAX/subtitle/etc.)
 *   - created_at/updated_at with defaults
 *
 * With that in place, we can add:
 *   async function upsertShowtimesFromShowtimesResponse(payload, { onOrAfter }) { ... }
 */


/**
 * Resolve our local cinema UUID by external MovieGlu cinema_id (integer).
 */
async function getCinemaUuidByExternalId(externalCinemaId) {
  const sql = `
    SELECT id
    FROM cinemas
    WHERE cinema_id = $1
    LIMIT 1;
  `;
  const { rows } = await db.query(sql, [Number(externalCinemaId)]);
  return rows[0]?.id ?? null;
}

/**
 * Resolve our local film UUID by imdb_title_id.
 */
async function getFilmUuidByImdbTitleId(imdbTitleId) {
  const sql = `
    SELECT id
    FROM films
    WHERE imdb_title_id = $1
    LIMIT 1;
  `;
  const { rows } = await db.query(sql, [String(imdbTitleId)]);
  return rows[0]?.id ?? null;
}

/**
 * Extract showtimes from a MovieGlu cinemaShowTimes payload.
 * Produces a flat list of:
 *   { imdb_title_id, start_time, display_start_time }
 *
 * MovieGlu shape (simplified/common):
 * payload.films[].showings[FORMAT_KEY].times[] => {
 *   start_time: "21:30",
 *   time: "21:30",                // sometimes just "time"
 *   datetime: "2024-10-01T21:30", // occasionally present
 *   display_time: "9:30 PM"
 * }
 */
function normalizeShowingsFromPayload(payload) {
  if (!payload || !Array.isArray(payload.films)) return [];

  const out = [];
  for (const f of payload.films) {
    const imdbTitleId = f.imdb_title_id ?? null;
    const showings = f.showings ?? {};
    // MovieGlu nests by format key (e.g., "Standard", "3D", "IMAX"); iterate defensively
    for (const key of Object.keys(showings)) {
      const fmt = showings[key];
      const times = Array.isArray(fmt?.times) ? fmt.times : [];
      for (const t of times) {
        const start =
          t.start_time ??
          t.time ??
          (typeof t.datetime === 'string' ? t.datetime.split('T')[1] : null);
        const display = t.display_time ?? t.display ?? null;
        if (!start) continue;
        out.push({
          imdb_title_id: imdbTitleId,
          start_time: String(start).slice(0, 8), // keep HH:MM(:SS) if present
          display_start_time: display ? String(display) : null,
        });
      }
    }
  }
  return out;
}

/**
 * Upsert showings for a given cinema + show_date.
 *
 * Parameters:
 * - payload: MovieGlu cinemaShowTimes response.
 * - opts:
 *    - showDateId: UUID of an existing row in show_dates (REQUIRED).
 *    - cinemaId: UUID of our local cinemas.id (optional if payload.cinema.cinema_id provided).
 *    - cinemaExternalId: integer of payload.cinema.cinema_id (optional; inferred from payload if not given).
 *
 * Behavior:
 * - Resolves cinema UUID (via cinemas.cinema_id) if not provided.
 * - Resolves film UUIDs by imdb_title_id (expects films already upserted).
 * - Inserts any new (cinema_id, film_id, show_date_id, start_time) combinations,
 *   skipping duplicates without needing a DB unique constraint by using a CTE.
 * - Returns counts: { prepared, inserted, skipped_missing_film, skipped_missing_cinema }
 */
async function upsertShowingsFromShowtimesResponse(payload, opts = {}) {
  const { showDateId, cinemaId: explicitCinemaId, cinemaExternalId } = opts;

  if (!showDateId) {
    throw new Error('upsertShowingsFromShowtimesResponse requires opts.showDateId (UUID of show_dates.id)');
  }

  // Resolve cinema UUID
  let cinemaId = explicitCinemaId ?? null;
  const extId = cinemaExternalId ?? payload?.cinema?.cinema_id ?? null;
  if (!cinemaId) {
    cinemaId = extId != null ? await getCinemaUuidByExternalId(extId) : null;
  }
  if (!cinemaId) {
    // Can't proceed usefully if we don't know which cinema row to attach to
    return { prepared: 0, inserted: 0, skipped_missing_film: 0, skipped_missing_cinema: 1 };
  }

  // Flatten showings from payload
  const flat = normalizeShowingsFromPayload(payload);

  // Map each to our local film_id
  const rows = [];
  let skippedMissingFilm = 0;
  for (const item of flat) {
    if (!item.imdb_title_id) {
      skippedMissingFilm++;
      continue;
    }
    // Resolve film UUID
    // eslint-disable-next-line no-await-in-loop
    const filmUuid = await getFilmUuidByImdbTitleId(item.imdb_title_id);
    if (!filmUuid) {
      skippedMissingFilm++;
      continue;
    }
    rows.push({
      cinema_id: cinemaId,
      film_id: filmUuid,
      show_date_id: showDateId,
      start_time: item.start_time, // Postgres will cast from text -> time
      display_start_time: item.display_start_time,
    });
  }

  if (rows.length === 0) {
    return {
      prepared: 0,
      inserted: 0,
      skipped_missing_film: skippedMissingFilm,
      skipped_missing_cinema: 0,
    };
  }

  // Build VALUES tuples for CTE insert-dedup
  const cols = ['cinema_id', 'film_id', 'show_date_id', 'start_time', 'display_start_time'];
  const values = [];
  const tuples = rows
    .map((r, i) => {
      const base = i * cols.length;
      values.push(r.cinema_id, r.film_id, r.show_date_id, r.start_time, r.display_start_time);
      return `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid, $${base + 4}::time, $${base + 5}::text)`;
    })
    .join(',\n');

  const sql = `
    WITH new_rows (${cols.join(', ')}) AS (
      VALUES
      ${tuples}
    )
    INSERT INTO showings (${cols.join(', ')})
    SELECT n.*
    FROM new_rows n
    LEFT JOIN showings s
      ON s.cinema_id = n.cinema_id
     AND s.film_id = n.film_id
     AND s.show_date_id = n.show_date_id
     AND s.start_time = n.start_time
    WHERE s.id IS NULL
    RETURNING id;
  `;

  const { rows: insertedRows } = await db.query(sql, values);
  return {
    prepared: rows.length,
    inserted: insertedRows.length,
    skipped_missing_film: skippedMissingFilm,
    skipped_missing_cinema: 0,
  };
}

/**
 * Count existing showings for a given cinema + show_date.
 * Pass UUIDs for both params.
 */
async function countShowingsForCinemaDate(cinemaId, showDateId) {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM showings
    WHERE cinema_id = $1::uuid
      AND show_date_id = $2::uuid
  `;
  const { rows } = await db.query(sql, [cinemaId, showDateId]);
  return rows[0]?.cnt ?? 0;
}

module.exports = {
  normalizeMovieGluFilms,
  upsertFilmsFromShowtimesResponse,
  getCinemaUuidByExternalId,
  getFilmUuidByImdbTitleId,
  normalizeShowingsFromPayload,
  upsertShowingsFromShowtimesResponse,
  countShowingsForCinemaDate,
};