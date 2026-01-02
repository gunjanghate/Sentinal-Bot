import { Worker } from "bullmq";
import bullRedis from "../../config/bullRedis.js";
import {
  fetchPullRequest,
  fetchPullRequestFiles,
} from "../../services/githubApi.service.js";
import { runScorer } from "../../services/scorer.services.js";
import { addLabelToPullRequest } from "../../services/github.services.js";
import PR from "../../models/PR.js";
import Contributor from "../../models/Contributor.js";

const EVENT_LABEL = "ECWoC26";

const prWorker = new Worker(
  "pr-queue",
  async (job) => {
    try {
      const {
        installation_id,
        repo_owner,
        repo_name,
        pr_number,
      } = job.data;

      console.log("👷 Processing PR:", pr_number);

      // 1️⃣ Fetch PR details
      const pr = await fetchPullRequest({
        installationId: installation_id,
        owner: repo_owner,
        repo: repo_name,
        prNumber: pr_number,
      });

      const isMerged = pr.merged === true;
      const hasEventLabel = pr.labels?.some(
        (label) => label.name === EVENT_LABEL
      );

      // 2️⃣ Idempotency check
      const existingPR = await PR.findOne({
        repoOwner: repo_owner,
        repoName: repo_name,
        prNumber: pr_number,
      });

      if (existingPR?.scored) {
        console.log(`⏭️ PR #${pr_number} already scored. Skipping.`);
        return { skipped: true, reason: "Already scored" };
      }

      // 3️⃣ Pending conditions (IMPORTANT CHANGE)
      if (!isMerged || !hasEventLabel) {
        console.log(
          `⏳ PR #${pr_number} pending — merged: ${isMerged}, label: ${hasEventLabel}`
        );

        // Optional: persist pending state (safe, idempotent)
        await PR.findOneAndUpdate(
          {
            repoOwner: repo_owner,
            repoName: repo_name,
            prNumber: pr_number,
          },
          {
            repoOwner: repo_owner,
            repoName: repo_name,
            prNumber: pr_number,
            contributor: pr.user.login,
            prTitle: pr.title,
            prUrl: pr.html_url,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
            scored: false,
            pendingReason: !isMerged
              ? "Not merged yet"
              : "Event label missing",
          },
          { upsert: true }
        );

        // Exit gracefully — job can be retriggered later
        return {
          pending: true,
          merged: isMerged,
          hasEventLabel,
        };
      }

      // 4️⃣ Fetch PR files
      const files = await fetchPullRequestFiles({
        installationId: installation_id,
        owner: repo_owner,
        repo: repo_name,
        prNumber: pr_number,
      });

      // 5️⃣ Run scorer
      const result = runScorer(pr, files);

      // 6️⃣ Compute metrics
      const locChanged = pr.additions + pr.deletions;
      const filesCount = files.length;
      const density = locChanged / Math.max(filesCount, 1);
      const newFilesCount = files.filter(
        (file) => file.status === "added"
      ).length;
      const hasTests = files.some(
        (file) =>
          /test|spec/i.test(file.filename) &&
          file.additions >= 10
      );

      // 7️⃣ Apply level label (best-effort)
      const levelLabel = `${EVENT_LABEL}-${result.level}`;
      try {
        await addLabelToPullRequest({
          installationId: installation_id,
          owner: repo_owner,
          repo: repo_name,
          prNumber: pr_number,
          label: levelLabel,
        });
        console.log(`🏷️ Applied label ${levelLabel}`);
      } catch (err) {
        console.error("⚠️ Labeling failed:", err.message);
      }

      // 8️⃣ Persist final PR record
      await PR.findOneAndUpdate(
        {
          repoOwner: repo_owner,
          repoName: repo_name,
          prNumber: pr_number,
        },
        {
          repoOwner: repo_owner,
          repoName: repo_name,
          prNumber: pr_number,
          contributor: pr.user.login,
          prTitle: pr.title,
          prUrl: pr.html_url,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
          score: result.score,
          level: result.level,
          points: result.points,
          reasons: result.reasons,
          metrics: {
            locChanged,
            filesChanged: filesCount,
            density,
            newFilesCount,
            hasTests,
          },
          scored: true,
          pendingReason: null,
        },
        { upsert: true, new: true }
      );

      // 9️⃣ Update contributor stats
      await Contributor.findOneAndUpdate(
        { githubUsername: pr.user.login },
        {
          $inc: {
            totalPoints: result.points,
            totalPRs: 1,
          },
          $set: {
            lastContributionAt: pr.merged_at
              ? new Date(pr.merged_at)
              : new Date(),
          },
        },
        { upsert: true }
      );

      console.log(
        `🏅 ${pr.user.login} awarded ${result.points} points (${result.level})`
      );

      return {
        prNumber: pr.number,
        ...result,
      };
    } catch (error) {
      console.error(
        `❌ Error processing PR job ${job.id}:`,
        error
      );
      throw error; // let BullMQ mark as failed
    }
  },
  {
    connection: bullRedis,
    concurrency: 5,
  }
);

export default prWorker;
