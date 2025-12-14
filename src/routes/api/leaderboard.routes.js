import express from "express";
import Contributor from "../../../models/Contributor.js";

const router = express.Router();

/**
 * GET /api/leaderboard
 * Returns contributors sorted by points
 */
router.get("/", async (req, res) => {
  try {
    const leaderboard = await Contributor.find()
      .sort({ totalPoints: -1 })
      .limit(50)
      .select("githubUsername totalPoints totalPRs -_id");

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard",
    });
  }
});

export default router;
