import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webhookRoutes from "../routes/webhook.routes.js";

dotenv.config();

const app = express();

// GitHub sends JSON but also signatures, so use raw body for webhook
app.use(express.json({ verify: (req, res, buf) => req.rawBody = buf }));

app.use(cors());


app.use("/api/webhook/github", webhookRoutes);

export default app;
