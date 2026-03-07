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
import { getContributorPoints } from "../../services/contributorPoints.js";
import { BLOCKED_USERS, BLOCKED_PROJECTS, SpecialProjects } from "../../config/hardgates.js";

const EVENT_LABEL = "ECWoC26";
const EVENT_END = new Date("2026-03-07T00:00:00.000Z");

const SPECIAL_FEATURE_LABEL = "feature-forge";
const SPECIAL_BUG_LABEL = "bug-bounty";

const isHardBlockedPR = ({ pr, repoOwner, repoName }) => {
  const username = pr?.user?.login?.toLowerCase() || "";
  const repoSlug = `${repoOwner}/${repoName}`.toLowerCase();
  const repoUrl =
    pr?.base?.repo?.html_url?.toLowerCase() ||
    pr?.head?.repo?.html_url?.toLowerCase() ||
    "";

  const blockedUsers = new Set((BLOCKED_USERS || []).map((u) => u.toLowerCase()));
  const blockedProjects = (BLOCKED_PROJECTS || []).map((p) => p.toLowerCase());

  if (blockedUsers.has(username)) {
    return {
      blocked: true,
      reason: `Contributor ${pr.user.login} is blocked for this event`,
    };
  }

  const matchesProject = blockedProjects.some((entry) => {
    if (!entry) return false;
    const normalized = entry.replace(/^https?:\/\/github\.com\//, "").toLowerCase();
    return repoSlug === normalized || repoUrl.endsWith(`/${normalized}`) || repoUrl === `https://github.com/${normalized}`;
  });

  if (matchesProject) {
    return {
      blocked: true,
      reason: `Repository ${repoSlug} is marked as removed for this event`,
    };
  }

  return { blocked: false };
};

const getSpecialProjectCategory = ({ pr, repoOwner, repoName }) => {
  const repoSlug = `${repoOwner}/${repoName}`.toLowerCase();
  const repoUrl =
    pr?.base?.repo?.html_url?.toLowerCase() ||
    pr?.head?.repo?.html_url?.toLowerCase() ||
    "";

  const specialProjects = (SpecialProjects || []).map((p) => p.toLowerCase());

  const isSpecialProject = specialProjects.some((entry) => {
    if (!entry) return false;
    const normalized = entry.replace(/^https?:\/\/github\.com\//, "").toLowerCase();
    return (
      repoSlug === normalized ||
      repoUrl.endsWith(`/${normalized}`) ||
      repoUrl === `https://github.com/${normalized}`
    );
  });

  if (!isSpecialProject) {
    return { isSpecial: false };
  }

  const labelNames = Array.isArray(pr.labels)
    ? pr.labels
      .map((l) => (typeof l?.name === "string" ? l.name.toLowerCase() : ""))
      .filter(Boolean)
    : [];

  const hasFeatureForge = labelNames.includes(SPECIAL_FEATURE_LABEL);
  const hasBugBounty = labelNames.includes(SPECIAL_BUG_LABEL);

  if (!hasFeatureForge && !hasBugBounty) {
    return { isSpecial: false };
  }

  // If both are present, treat as bug-bounty (higher tier)
  if (hasBugBounty) {
    return {
      isSpecial: true,
      category: "bug-fix",
      fixedPoints: 100,
    };
  }

  if (hasFeatureForge) {
    return {
      isSpecial: true,
      category: "feat-added",
      fixedPoints: 50,
    };
  }

  return { isSpecial: false };
};

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
      const createdAt = pr?.created_at ? new Date(pr.created_at) : null;
      const contributor = pr.user.login;
      const points = await getContributorPoints(contributor);

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

      // 3️⃣ Event window end: PRs created after event end are not scored
      if (createdAt && createdAt >= EVENT_END) {
        const locChanged = (pr.additions || 0) + (pr.deletions || 0);

        const result = {
          score: 0,
          level: "ENDED",
          points: 0,
          reasons: [
            "Event period has ended; PR not eligible for scoring",
          ],
        };

        const endedLabel = `${EVENT_LABEL}-ENDED`;
        try {
          await addLabelToPullRequest({
            installationId: installation_id,
            owner: repo_owner,
            repo: repo_name,
            prNumber: pr_number,
            label: endedLabel,
          });
          console.log(`🏷️ Applied label ${endedLabel} for post-event PR`);
        } catch (err) {
          console.error("⚠️ Labeling (ENDED) failed:", err.message);
        }

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
              filesChanged: 0,
              density: 0,
              newFilesCount: 0,
              hasTests: false,
            },
            scored: true,
            pendingReason: "Event period ended",
          },
          { upsert: true, new: true }
        );

        console.log(
          `⏹️ PR #${pr_number} marked as ENDED (created after event period)`
        );

        return {
          prNumber: pr.number,
          ...result,
          eventEnded: true,
        };
      }

      // 4️⃣ Pending conditions (IMPORTANT CHANGE)
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

      // 5️⃣ HARD GATE: Removed / disqualified projects & users
      const { blocked, reason: hardgateReason } = isHardBlockedPR({
        pr,
        repoOwner: repo_owner,
        repoName: repo_name,
      });

      if (blocked) {
        const locChanged = pr.additions + pr.deletions;

        const result = {
          score: 0,
          level: "REMOVED",
          points: 0,
          reasons: [
            "Project marked as removed according to event rules",
            ...(hardgateReason ? [hardgateReason] : []),
          ],
        };

        const removedLabel = `${EVENT_LABEL}-REMOVED`;
        try {
          await addLabelToPullRequest({
            installationId: installation_id,
            owner: repo_owner,
            repo: repo_name,
            prNumber: pr_number,
            label: removedLabel,
          });
          console.log(`🏷️ Applied label ${removedLabel} for removed project/user`);
        } catch (err) {
          console.error("⚠️ Labeling (REMOVED) failed:", err.message);
        }

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
              filesChanged: 0,
              density: 0,
              newFilesCount: 0,
              hasTests: false,
            },
            scored: true,
            pendingReason: null,
          },
          { upsert: true, new: true }
        );

        console.log(
          `🚫 PR #${pr_number} marked as REMOVED (${hardgateReason || "blocked project/user"})`
        );

        return {
          prNumber: pr.number,
          ...result,
          removed: true,
        };
      }

      // 6️⃣ Fetch PR files
      const files = await fetchPullRequestFiles({
        installationId: installation_id,
        owner: repo_owner,
        repo: repo_name,
        prNumber: pr_number,
      });

      // 7️⃣ Run scorer
      console.log(`🔢 Scoring PR #${pr_number} with ${files.length} files changed and contributor points: ${points}`);
      let result = runScorer(pr, files, points);

      // 7️⃣a Special projects: override level/points and label when applicable
      const specialContext = getSpecialProjectCategory({
        pr,
        repoOwner: repo_owner,
        repoName: repo_name,
      });

      if (specialContext.isSpecial) {
        result = {
          ...result,
          level: specialContext.category,
          points: specialContext.fixedPoints,
          bonusApplied: false,
          reasons: [
            ...(Array.isArray(result.reasons) ? result.reasons : []),
            `Special project (${specialContext.category}) with fixed points (${specialContext.fixedPoints}) and no multiplier`,
          ],
        };
      }

      console.log(`🎯 Scoring result for PR #${pr_number}:`, result);

      // 8️⃣ Compute metrics
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

      // 9️⃣ Apply label (best-effort)
      const levelLabel = specialContext.isSpecial
        ? `${EVENT_LABEL}-${specialContext.category}`
        : result.bonusApplied
          ? `${EVENT_LABEL}-SPRINT-${result.level}`
          : `${EVENT_LABEL}-${result.level}`;
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

      // 🔟 Persist final PR record
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

      // 1️⃣1️⃣ Update contributor stats
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
    removeOnComplete: {
      count: 100,  // keep only last 100 completed jobs
    },
    removeOnFail: {
      count: 100,  // keep last 100 failed jobs
    },
  }
);

export default prWorker;
