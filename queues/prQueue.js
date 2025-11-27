import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const prQueue = new Queue("pr-queue", {
  connection: redis,
});
