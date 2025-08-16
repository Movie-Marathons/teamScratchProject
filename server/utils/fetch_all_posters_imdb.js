#!/usr/bin/env node
/**
 * Bulk fetch primary posters from imdbapi.dev and store base64 in `images`.
 *
 * Usage:
 *   node server/scripts/fetch_all_posters_imdb.js --limit=500 --concurrency=5 --dry-run
 *
 * Flags:
 *   --limit=<n>         Process at most n films (default: unlimited)
 *   --concurrency=<n>   Parallel downloads (default: 4)
 *   --dry-run           Don’t write to DB; just report what would happen
 *
 * Assumptions:
 *   - DB has:
 *       films(id uuid pk, imdb_title_id text, name text, ...)
 *       images(id uuid pk, film_id uuid fk -> films, image_base64 text, alt_text text)
 *   - imdbapi.dev: GET https://api.imdbapi.dev/titles/{imdb_title_id}
 */

const path = require('path');
const axios = require('axios');
const process = require('process');

// Adjust relative to this file’s location: server/scripts -> server/db
const db = require('../db');

// -------- CLI flags --------
const argv = process.argv.slice(2);
function getFlag(name, defVal) {
  const m = argv.find(a => a.startsWith(`--${name}=`));
  if (!m) return defVal;
  const v = m.split('=')[1];
  if (v == null || v === '') return defVal;
  if (['concurrency', 'limit'].includes(name)) return Number(v);
  return v;
}
const DRY_RUN = argv.includes('--dry-run');
const CONCURRENCY = getFlag('concurrency', 4);
const LIMIT = getFlag('limit', Infinity);

// -------- Utilities --------
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function withRetries(fn, { retries = 3, baseDelayMs = 500 }) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const status = err?.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600) || !status;
      if (!retryable || attempt > retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // expo backoff
      await sleep(delay);
    }
  }
}

// -------- DB selectors/writers --------
async function getMissingFilms(limit = Infinity) {
  const sql = `
    SELECT f.id AS film_id, f.imdb_title_id, f.name
    FROM films f
    LEFT JOIN images i ON i.film_id = f.id
    WHERE f.imdb_title_id IS NOT NULL
      AND i.id IS NULL
    ORDER BY f.updated_at DESC NULLS LAST, f.id
    ${Number.isFinite(limit) ? `LIMIT ${Math.max(0, limit)}` : ''}
  `;
  const { rows } = await db.query(sql);
  return rows;
}

async function insertImage({ film_id, image_base64, alt_text }) {
  const sql = `
    INSERT INTO images (film_id, image_base64, alt_text)
    VALUES ($1::uuid, $2::text, $3::text)
    RETURNING id;
  `;
  const vals = [film_id, image_base64, alt_text];
  const { rows } = await db.query(sql, vals);
  return rows[0]?.id ?? null;
}

// -------- IMDB fetchers --------
async function fetchImdbTitleJson(imdbTitleId) {
  const url = `https://api.imdbapi.dev/titles/${encodeURIComponent(imdbTitleId)}`;
  const { data } = await withRetries(() => axios.get(url, { timeout: 15000 }), { retries: 3 });
  return data;
}

async function downloadImageToBase64(url) {
  const resp = await withRetries(
    () => axios.get(url, { responseType: 'arraybuffer', timeout: 20000 }),
    { retries: 3 }
  );
  return Buffer.from(resp.data).toString('base64');
}

// -------- Worker pipeline --------
async function processFilm({ film_id, imdb_title_id, name }) {
  try {
    const meta = await fetchImdbTitleJson(imdb_title_id);
    const primaryUrl = meta?.primaryImage?.url || null;
    if (!primaryUrl) {
      return { film_id, imdb_title_id, name, status: 'no_image' };
    }
    const b64 = await downloadImageToBase64(primaryUrl);
    const alt = `Poster (IMDB) ${name ?? imdb_title_id}`;

    if (DRY_RUN) {
      return { film_id, imdb_title_id, name, status: 'would_insert', bytes: b64.length };
    }

    const imageId = await insertImage({ film_id, image_base64: b64, alt_text: alt });
    return { film_id, imdb_title_id, name, status: 'inserted', image_id: imageId, bytes: b64.length };
  } catch (err) {
    const status = err?.response?.status;
    const msg = status ? `HTTP ${status}` : (err?.message || 'unknown error');
    return { film_id, imdb_title_id, name, status: 'error', error: msg };
  }
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let inFlight = 0;
  let idx = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (idx >= items.length && inFlight === 0) return resolve(results);
      while (inFlight < concurrency && idx < items.length) {
        const item = items[idx++];
        inFlight++;
        worker(item)
          .then(res => results.push(res))
          .catch(err => results.push({ status: 'error', error: err?.message || String(err), item }))
          .finally(() => { inFlight--; next(); });
      }
    };
    next();
  });
}

// -------- Main --------
(async function main() {
  console.log(`Starting IMDB poster fetcher with concurrency=${CONCURRENCY}, limit=${LIMIT}, dryRun=${DRY_RUN}`);
  const films = await getMissingFilms(LIMIT);
  console.log(`Found ${films.length} film(s) missing images.`);

  if (films.length === 0) {
    console.log('Nothing to do. Exiting.');
    process.exit(0);
  }

  const startedAt = Date.now();
  const results = await runPool(films, CONCURRENCY, processFilm);

  // Summarize
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('--- Summary ---');
  console.table(counts);
  if (DRY_RUN) {
    const sample = results.slice(0, 10);
    console.log('Sample results:', sample);
  } else {
    const errors = results.filter(r => r.status === 'error').slice(0, 10);
    if (errors.length) {
      console.log('Sample errors:', errors);
    }
  }
  console.log(`Done in ${durationSec}s`);
  process.exit(0);
})().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});