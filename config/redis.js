import { Redis } from "ioredis";

// BullMQ requires maxRetriesPerRequest to be null for blocking ops
export const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on("connect", () => console.log("🔗 Redis connected"));
redis.on("error", (err) => console.log("❌ Redis error", err));

export default redis;
