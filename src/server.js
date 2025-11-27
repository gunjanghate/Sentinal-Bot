import app from "./app.js";
import connectDB from "../config/db.js";
import "../config/redis.js";  // Redis connection
import "../queues/workers/pr.worker.js";  // Start workers

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(` Server🚶🏻‍♂️‍➡️rha hai http://localhost:${PORT}`);
  });
}

start();
