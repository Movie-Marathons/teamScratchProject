// server/services/cinemaShowTimes.service.js
// Service for fetching MovieGlu cinema showtimes and persisting into DB.

const {
  upsertFilmsFromShowtimesResponse,
  upsertShowingsFromShowtimesResponse,
  normalizeShowingsFromPayload,
  countShowingsForCinemaDate,
  // optional helpers; if your repo doesn't export them, they'll be undefined
  ensureShowDateForCinemaDate,
  getShowDateIdForCinemaDate,
} = require('../repos/cinemaShowTimesRepo');

const { getCinemaShowTimes } = require('../api/cinemaShowTimesApi'); // keep API layer consistent with getCinemas
const cinemaRepo = require('../repos/cinemaRepo'); // to ensure cinema exists if needed

/**
 * Ensure a local cinema row exists for a given external MovieGlu cinema_id.
 * Returns the local cinemas.id (uuid) or null if not found and cannot create.
 */
async function ensureLocalCinemaByExternalId(externalCinemaId) {
  try {
    // Try resolve by external id (cinemas.cinema_id)
    if (typeof cinemaRepo.getCinemaUuidByExternalId === 'function') {
      const found = await cinemaRepo.getCinemaUuidByExternalId(externalCinemaId);
      if (found) return found;
    }
    // Fallback: ensure a minimal row exists if helper is available
    if (typeof cinemaRepo.ensureLocalCinemaByExternalId === 'function') {
      const ensured = await cinemaRepo.ensureLocalCinemaByExternalId(externalCinemaId);
      if (ensured) return ensured;
    }
  } catch (e) {
    // swallow and return null; caller will handle null
  }
  return null;
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
  const incomingShowDateId = (opts?.showDateId ? String(opts.showDateId) : '');

  if (!cinemaExternalId || !dateISO) {
    throw new Error('ingestForCinema requires { cinemaExternalId, dateISO(YYYY-MM-DD) }');
  }

  // Resolve cinema UUID first (needed for cache check)
  let cinemaId = await ensureLocalCinemaByExternalId(cinemaExternalId);

  // Resolve or create a show_date row for this cinema/date when not provided
  let showDateId = incomingShowDateId || '';
  if (!showDateId) {
    // Try to resolve via repo helper if available
    if (cinemaId && typeof getShowDateIdForCinemaDate === 'function') {
      showDateId = await getShowDateIdForCinemaDate(cinemaId, dateISO);
    }
    // If still not found, try to ensure/create it
    if (!showDateId && cinemaId && typeof ensureShowDateForCinemaDate === 'function') {
      showDateId = await ensureShowDateForCinemaDate(cinemaId, dateISO);
    }
  }

  // If we still do not have a showDateId, we cannot safely insert showings with FK
  if (!showDateId) {
    return {
      ok: false,
      reason: 'MISSING_SHOW_DATE_ID',
      cinemaExternalId,
      dateISO,
      show_date_id: null,
      counts: { films: 0, showingsPrepared: 0, showingsInserted: 0 },
      sample: [],
    };
  }

  // Check cache: if we already have showings for this cinema/date, skip API call
  if (cinemaId && showDateId) {
    const existingCount = await countShowingsForCinemaDate(cinemaId, showDateId);
    if (existingCount > 0) {
      return {
        ok: true,
        reason: 'CACHE_HIT',
        cinemaExternalId,
        dateISO,
        show_date_id: showDateId,
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
    show_date_id: showDateId,
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