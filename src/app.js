import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import leaderboardRoutes from "./routes/api/leaderboard.routes.js";
import prRoutes from "./routes/api/pr.routes.js";


dotenv.config();

const app = express();

// GitHub sends a signature that depends on RAW BODY
// So we store rawBody before Express turns it into JSON
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;  // important for signature validation
    },
  })
);


app.use(cors());

import webhookRoutes from "../routes/webhook.routes.js";

// Mount route — this is where GitHub will send PR events
app.use("/api/webhook/github", webhookRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/prs", prRoutes);

export default app;
