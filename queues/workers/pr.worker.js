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

            // 2️⃣ HARD GATE: Check event label
            const hasEventLabel = pr.labels?.some(
                (label) => label.name === EVENT_LABEL
            );

            if (!hasEventLabel) {
                console.log(
                    `⏭️ PR #${pr.number} skipped — missing label "${EVENT_LABEL}"`
                );
                return {
                    skipped: true,
                    reason: "Missing event label",
                };
            }

            // 3️⃣ Only merged PRs are scored
            if (!pr.merged) {
                console.log(`⏭️ PR #${pr.number} not merged yet. Skipping.`);
                return {
                    skipped: true,
                    reason: "PR not merged",
                };
            }

            // 4️⃣ Idempotency check (already scored?)
            const existingPR = await PR.findOne({
                repoOwner: repo_owner,
                repoName: repo_name,
                prNumber: pr_number,
            });

            if (existingPR?.scored) {
                console.log(`⏭️ PR #${pr_number} already scored. Skipping.`);
                return {
                    skipped: true,
                    reason: "Already scored",
                };
            }

            // 5️⃣ Fetch PR files
            const files = await fetchPullRequestFiles({
                installationId: installation_id,
                owner: repo_owner,
                repo: repo_name,
                prNumber: pr_number,
            });

            console.log("📄 PR title:", pr.title);
            console.log("📂 Files changed:", files.length);

            // 6️⃣ Run scorer
            const result = runScorer(pr, files);

            // 6️⃣.1️⃣ Compute metrics for persistence
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

            // 6.1️⃣ Apply ECWoC26 level label (best-effort)
            const levelLabel = `${EVENT_LABEL}-${result.level}`;

            try {
                await addLabelToPullRequest({
                    installationId: installation_id,
                    owner: repo_owner,
                    repo: repo_name,
                    prNumber: pr_number,
                    label: levelLabel,
                });

                console.log(
                    `🏷️ Applied label ${levelLabel} to PR ${repo_owner}/${repo_name}#${pr_number}`
                );
            } catch (labelError) {
                console.error(
                    `⚠️ Failed to apply label ${levelLabel} to PR ${repo_owner}/${repo_name}#${pr_number}:`,
                    labelError
                );
                // Do NOT rethrow: labeling failure must not fail scoring job
            }

            // 7️⃣ Save PR record
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
                },
                { upsert: true, new: true }
            );

            // 8️⃣ Update contributor stats
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
                `🏅 Points assigned to ${pr.user.login}: +${result.points}`
            );

            console.log("🎯 PR Scored:", {
                pr: pr.number,
                level: result.level,
                points: result.points,
            });

            return {
                prNumber: pr.number,
                ...result,
            };
        } catch (error) {
            console.error(
                `❌ Error processing PR job ${job.id} for ${job?.data?.repo_owner}/${job?.data?.repo_name}#${job?.data?.pr_number}:`,
                error
            );
            // Re-throw so BullMQ marks this job as failed instead of hanging
            throw error;
        }
    },
    {
        connection: bullRedis,
        concurrency: 5,
    }
);

export default prWorker;
