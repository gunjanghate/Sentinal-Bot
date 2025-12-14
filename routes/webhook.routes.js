import express from "express";
import { handleGitHubWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

// Webhook route where GitHub App sends PR events
router.post("/", handleGitHubWebhook);

export default router;
