import mongoose from "mongoose";

const contributorSchema = new mongoose.Schema(
  {
    githubUsername: { type: String, required: true, unique: true },

    totalPoints: { type: Number, default: 0 },
    totalPRs: { type: Number, default: 0 },
    lastContributionAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Contributor", contributorSchema);
