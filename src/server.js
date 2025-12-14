import app from "./app.js";
import connectDB from "../config/db.js";
import "../config/redis.js"; // initializes Redis connection
import "../queues/workers/pr.worker.js"; // starts PR worker

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
