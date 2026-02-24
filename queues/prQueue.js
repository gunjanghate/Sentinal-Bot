import { Queue } from "bullmq";
import redis from "../config/redis.js";

export const prQueue = new Queue("pr-queue", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: {
      count: 100,   // keep only last 100 completed jobs
    },
    removeOnFail: {
      count: 100,   // keep last 100 failed jobs
    },
  },
});