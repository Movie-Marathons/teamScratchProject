

// server/repos/moviePosterRepo.js
// Data-access functions for the `images` table (movie posters/stills)
// Schema reference:
//   create table public.images (
//     id uuid primary key default gen_random_uuid(),
//     film_id uuid references films(id) on delete cascade,
//     image_base64 text,
//     alt_text text
//   );

const db = require('../db');

/**
 * Get all poster/still rows for a film (ordered by id for stability)
 * @param {string} film_id - internal films.id (uuid)
 * @returns {Promise<Array<{id:string, film_id:string, alt_text:string}>>}
 */
async function listByFilmId(film_id) {
  const { rows } = await db.query(
    `SELECT id, film_id, alt_text
     FROM images
     WHERE film_id = $1
     ORDER BY id DESC`,
    [film_id]
  );
  return rows;
}

/**
 * Create a single poster/still row
 * @param {{ film_id:string, image_base64:string, alt_text?:string }} input
 * @returns {Promise<{id:string, film_id:string, alt_text:string}>}
 */
async function createPoster({ film_id, image_base64, alt_text = null }) {
  const { rows } = await db.query(
    `INSERT INTO images (film_id, image_base64, alt_text)
     VALUES ($1, $2, $3)
     RETURNING id, film_id, alt_text`,
    [film_id, image_base64, alt_text]
  );
  return rows[0];
}

/**
 * Bulk insert multiple poster/still rows for a film.
 * @param {string} film_id
 * @param {Array<{ image_base64:string, alt_text?:string }>} items
 * @returns {Promise<Array<{id:string, film_id:string, alt_text:string}>>}
 */
async function bulkInsert(film_id, items = []) {
  if (!items.length) return [];

  // Build VALUES list: ($1,$2,$3), ($1,$4,$5), ... where $1 is the shared film_id
  const values = [];
  const params = [film_id];
  for (let i = 0; i < items.length; i++) {
    const base = 2 + i * 2; // indexes for image_base64, alt_text
    values.push(`($1, $${base}, $${base + 1})`);
    params.push(items[i].image_base64);
    params.push(items[i].alt_text ?? null);
  }

  const { rows } = await db.query(
    `INSERT INTO images (film_id, image_base64, alt_text)
     VALUES ${values.join(', ')}
     RETURNING id, film_id, alt_text`,
    params
  );
  return rows;
}

/**
 * True if any image exists for this film
 * @param {string} film_id
 * @returns {Promise<boolean>}
 */
async function existsForFilm(film_id) {
  const { rows } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM images WHERE film_id = $1) AS present`,
    [film_id]
  );
  return !!rows[0]?.present;
}

/**
 * Delete a poster row by id
 * @param {string} id
 * @returns {Promise<boolean>} - true if deleted
 */
async function deleteById(id) {
  const { rowCount } = await db.query(
    `DELETE FROM images WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
}

module.exports = {
  listByFilmId,
  createPoster,
  bulkInsert,
  existsForFilm,
  deleteById,
};