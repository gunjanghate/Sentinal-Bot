import mongoose from "mongoose";

const prSchema = new mongoose.Schema(
  {
    repoOwner: { type: String, required: true },
    repoName: { type: String, required: true },
    prNumber: { type: Number, required: true },

    contributor: { type: String, required: true }, // GitHub username

    prTitle: String,
    prUrl: String,
    mergedAt: Date,

    score: Number,
    level: String,
    points: Number,
    reasons: [String],
    metrics: {
      locChanged: Number,
      filesChanged: Number,
      density: Number,
      newFilesCount: Number,
      hasTests: Boolean,
    },


    scored: { type: Boolean, default: false },
  },
  { timestamps: true }
);


// Ensure one PR is stored only once
prSchema.index({ repoOwner: 1, repoName: 1, prNumber: 1 }, { unique: true });

export default mongoose.model("PR", prSchema);
