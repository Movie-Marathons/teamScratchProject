
// server/services/cinemaShowTimes.service.js
// Service for fetching MovieGlu cinema showtimes and persisting into DB.

const {
  upsertFilmsFromShowtimesResponse,
  upsertShowingsFromShowtimesResponse,
  normalizeShowingsFromPayload,
  getCinemaUuidByExternalId,
  countShowingsForCinemaDate,
} = require('../repos/cinemaShowTimesRepo');

const { getCinemaShowTimes } = require('../api/cinemaShowTimesApi'); // keep API layer consistent with getCinemas
const cinemaRepo = require('../repos/cinemaRepo'); // to ensure cinema exists if needed

/**
 * Ensure a local cinema row exists for a given external MovieGlu cinema_id.
 * Returns the local cinemas.id (uuid) or null if not found and cannot create.
 */
async function ensureLocalCinemaByExternalId(externalCinemaId) {
  // Try resolve by external id (cinemas.cinema_id)
  const cinemaUuid = await getCinemaUuidByExternalId(externalCinemaId);
  if (cinemaUuid) return cinemaUuid;

  // If not in DB, attempt a minimal creation by pulling from MovieGlu cinemas list
  // NOTE: We only try this if your cinemaRepo has an upsertCinemas path and you can provide enough fields.
  // If you prefer to fail fast, remove this block and return null.
  try {
    // Some environments may not have a direct single-cinema endpoint; skip auto-create.
    return null;
  } catch {
    return null;
  }
}

/**
 * Ingest showtimes for a given external cinema_id (MovieGlu) and date.
 *
 * @param {Object} opts
 * @param {number|string} opts.cinemaExternalId - MovieGlu cinema_id (integer).
 * @param {string} opts.dateISO - Date string "YYYY-MM-DD" to request showtimes for.
 * @param {string} opts.showDateId - UUID of the show_dates row representing the same calendar day.
 * @returns {Promise<Object>} - Summary of ingest results and a flattened preview of showtimes.
 */
async function ingestForCinema(opts) {
  const cinemaExternalId = Number(opts?.cinemaExternalId);
  const dateISO = String(opts?.dateISO || '').slice(0, 10);
  const showDateId = String(opts?.showDateId || '');

  if (!cinemaExternalId || !dateISO || !showDateId) {
    throw new Error('ingestForCinema requires { cinemaExternalId, dateISO(YYYY-MM-DD), showDateId }');
  }

  // Resolve cinema UUID first (needed for cache check)
  let cinemaId = await ensureLocalCinemaByExternalId(cinemaExternalId);

  // Check cache: if we already have showings for this cinema/date, skip API call
  if (cinemaId) {
    const existingCount = await countShowingsForCinemaDate(cinemaId, showDateId);
    if (existingCount > 0) {
      return {
        ok: true,
        reason: 'CACHE_HIT',
        cinemaExternalId,
        dateISO,
        counts: { existingShowings: existingCount },
        sample: []
      };
    }
  }

  // Call MovieGlu API
  const payload = await getCinemaShowTimes(cinemaExternalId, dateISO);

  if (!payload || !Array.isArray(payload?.films)) {
    return {
      ok: false,
      reason: 'EMPTY_OR_INVALID_PAYLOAD',
      cinemaExternalId,
      dateISO,
      counts: { films: 0, showingsPrepared: 0, showingsInserted: 0 },
      sample: [],
    };
  }

  // 1) Upsert films so we have film_id UUIDs available
  const filmResult = await upsertFilmsFromShowtimesResponse(payload);

  // 2) Upsert showings
  const showingsResult = await upsertShowingsFromShowtimesResponse(payload, {
    showDateId,
    cinemaId,                // may be null; repo will try to resolve using payload.cinema.cinema_id
    cinemaExternalId,        // fallback hint if payload doesn't include cinema.cinema_id
  });

  // Build a small flattened preview for the controller/response if needed
  const flattened = normalizeShowingsFromPayload(payload)
    .slice(0, 50); // cap preview

  return {
    ok: true,
    cinemaExternalId,
    dateISO,
    counts: {
      filmsInserted: filmResult.inserted,
      filmsUpdated: filmResult.updated,
      showingsPrepared: showingsResult.prepared,
      showingsInserted: showingsResult.inserted,
      skippedMissingFilm: showingsResult.skipped_missing_film,
      skippedMissingCinema: showingsResult.skipped_missing_cinema,
    },
    sample: flattened,
  };
}

module.exports = {
  ingestForCinema,
};