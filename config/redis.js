import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("🔗 Redis Connected Successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err);
});

export default redis;



// ➤ What this file does:
// Creates a Redis connection using ioredis
// Makes Redis available to queues + workers
// Logs when Redis connects or errors
// Ensures the queue system works across entire backend

// Redis will be used for:
// PR Processing Queue
