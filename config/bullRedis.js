import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

const bullRedis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,

});

bullRedis.on("connect", () => {
  console.log("🔗 Redis Connected Successfully");
});

bullRedis.on("ready", () => {
  console.log("✅ Redis Ready");
});

bullRedis.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err);
});

export default bullRedis;
