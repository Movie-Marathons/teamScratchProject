const { MG_CLIENT, MG_API_KEY, MG_AUTH, MG_TERRITORY, MG_API_VERSION, MG_GEO } = process.env;

// server/api/cinemaShowTimesApi.js
// MovieGlu: cinemaShowTimes endpoint wrapper
// NOTE: This returns the FULL payload (not just films)
// so the service/repo layers can do film + showings upserts.

require('dotenv').config();

const headers = {
  client: process.env.MG_CLIENT || '',
  'x-api-key': process.env.MG_API_KEY || '',
  Authorization: process.env.MG_AUTH || '',
  territory: process.env.MG_TERRITORY || 'US',
  'api-version': process.env.MG_API_VERSION || 'v201',
  'user-agent': process.env.MG_USER_AGENT || 'MovieGluTestApp',
  Accept: 'application/json',
};

/**
 * Fetch showtimes for a cinema and date.
 * @param {number|string} cinemaId - MovieGlu cinema_id (integer).
 * @param {string} dateISO - "YYYY-MM-DD"
 * @returns {Promise<object>} Full JSON payload from MovieGlu
 */
async function getCinemaShowTimes(cinemaId, dateISO) {
  const fullHeaders = {
    ...headers,
    'device-datetime': new Date().toISOString(),
  };

  const url = `https://api-gate2.movieglu.com/cinemaShowTimes/?cinema_id=${Number(
    cinemaId
  )}&date=${encodeURIComponent(dateISO)}&sort=popularity`;

  const res = await fetch(url, { headers: fullHeaders });
  const text = await res.text();

  // If the status is an error, surface the response text but keep the original behavior
  if (!res.ok) {
    throw new Error(
      `Showtime API error: ${res.status} - ${text ? text.substring(0, 200) : 'No response text'}`
    );
  }

  // MovieGlu may return 204 No Content or an empty body for some cinemas/dates.
  // Instead of throwing, return a safe minimal payload so upper layers can decide.
  if (!text || !text.trim()) {
    return {
      films: [],
      cinema: { cinema_id: Number(cinemaId) },
      _meta: { empty: true, dateISO },
    };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // Invalid JSON — return a safe structure rather than fail hard
    return {
      films: [],
      cinema: { cinema_id: Number(cinemaId) },
      _meta: { invalid_json: true, dateISO, rawLength: text.length },
    };
  }

  // Ensure films array exists for callers
  if (!data || !Array.isArray(data.films)) {
    return {
      ...data,
      films: [],
      cinema: data?.cinema ?? { cinema_id: Number(cinemaId) },
      _meta: { normalized: true, dateISO },
    };
  }

  return data;
}

module.exports = {
  getCinemaShowTimes,
};
