import express from "express";
import { handleGitHubWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/", handleGitHubWebhook);

export default router;
