// server/utils/cache.js
const crypto = require("crypto");
const { redis } = require("./redis");

let cacheHits = 0;
let cacheMisses = 0;

function buildCacheKey(ns, path, query) {
  const stable = JSON.stringify(query ?? {});
  const hash = crypto.createHash("sha1").update(path + "::" + stable).digest("hex");
  return `${ns}:${path}:${hash}`;
}

async function getCached(key) {
  const raw = await redis.get(key);
  if (!raw) {
    cacheMisses++;
    console.log("[cache] MISS", key, "hits:", cacheHits, "misses:", cacheMisses);
    return null;
  }
  try {
    cacheHits++;
    console.log("[cache] HIT", key, "hits:", cacheHits, "misses:", cacheMisses);
    return JSON.parse(raw);
  } catch (err) {
    cacheMisses++;
    console.warn("[cache] PARSE ERROR, treating as miss", key, err);
    return null;
  }
}

async function setCached(key, value, ttlSeconds) {
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, payload, "EX", ttlSeconds);
  } else {
    await redis.set(key, payload);
  }
}

/** Use tight patterns, e.g., `showtimes:/api/cinemas/9218/showtimes:*` */
async function invalidateByPattern(pattern) {
  let cursor = "0";
  const pipeline = redis.pipeline();
  let foundAny = false;

  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = next;
    if (keys.length) {
      foundAny = true;
      for (const k of keys) pipeline.del(k);
    }
  } while (cursor !== "0");

  if (foundAny) await pipeline.exec();
}

module.exports = {
  buildCacheKey,
  getCached,
  setCached,
  invalidateByPattern,
  cacheHits,
  cacheMisses,
};