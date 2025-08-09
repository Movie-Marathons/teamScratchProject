require('dotenv').config();
// server/db/index.js
const { Pool } = require('pg');

const {
  DATABASE_URL,
  PG_POOL_MIN = 0,
  PG_POOL_MAX = 5,
  PG_IDLE_TIMEOUT_MS = 10000,
} = process.env;

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in .env');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL; this is fine for server-side
  min: Number(PG_POOL_MIN),
  max: Number(PG_POOL_MAX),
  idleTimeoutMillis: Number(PG_IDLE_TIMEOUT_MS),
});

pool.on('error', (err) => {
  console.error('PG pool error:', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('PG query', { text: text.split('\n')[0], rows: res.rowCount, ms: duration });
  }
  return res;
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };