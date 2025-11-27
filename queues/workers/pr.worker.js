import { Worker } from "bullmq";
import redis from "../../config/redis.js";
import { processPRJob } from "../../services/github.services.js";

const prWorker = new Worker(
    "pr-queue",
    async (job) => {
        console.log("👷 Processing job:", job.name);
        return await processPRJob(job.data);
    },
    { connection: redis }
);

prWorker.on("completed", (job) =>
    console.log(`✅ Job completed: ${job.id}`)
);

prWorker.on("failed", (job, err) =>
    console.log(`❌ Job failed: ${job.id} ${err}`)
);
