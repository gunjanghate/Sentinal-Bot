import express from "express";
import PR from "../../../models/PR.js";

const router = express.Router();

/**
 * GET /api/prs
 * Returns all scored PRs
 */
router.get("/", async (req, res) => {
  try {
    const prs = await PR.find({ scored: true })
      .sort({ createdAt: -1 })
      .select("-__v -updatedAt");

    res.json({
      success: true,
      data: prs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch PRs",
    });
  }
});

export default router;
