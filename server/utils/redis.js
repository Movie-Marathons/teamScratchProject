// server/utils/redis.js
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableAutoPipelining: true,
});

redis.on("connect", () => console.log("[redis] connected:", redisUrl));
redis.on("error", (err) => console.error("[redis] error:", err));

async function redisHealthcheck() {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

module.exports = { redis, redisHealthcheck };