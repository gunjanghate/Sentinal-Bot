import { Worker } from "bullmq";
import redis from "../../config/redis.js";
import {
    fetchPullRequest,
    fetchPullRequestFiles,
} from "../../services/githubApi.service.js";
import PR from "../../models/PR.js";
import Contributor from "../../models/Contributor.js";

const prWorker = new Worker(
    "pr-queue",
    async (job) => {
        const {
            installation_id,
            repo_owner,
            repo_name,
            pr_number,
        } = job.data;

        console.log("👷 Processing PR:", pr_number);

        const pr = await fetchPullRequest({
            installationId: installation_id,
            owner: repo_owner,
            repo: repo_name,
            prNumber: pr_number,
        });
        if (!pr.merged) {
            console.log(`PR #${pr.number} is not merged yet. Skipping.`);
            return {
                skipped: true,
                reason: "PR not merged",
            };
        }
        const existingPR = await PR.findOne({
            repoOwner: repo_owner,
            repoName: repo_name,
            prNumber: pr_number,
        });

        if (existingPR?.scored) {
            console.log(`⏭️ PR #${pr_number} already scored. Skipping.`);
            return { skipped: true, reason: "Already scored" };
        }


        const files = await fetchPullRequestFiles({
            installationId: installation_id,
            owner: repo_owner,
            repo: repo_name,
            prNumber: pr_number,
        });

        console.log("📄 PR title:", pr.title);
        console.log("📂 Files changed:", files.length);

        const result = runScorer(pr, files);

        // 1️⃣ Save PR record
        const prRecord = await PR.findOneAndUpdate(
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

                score: result.score,
                level: result.level,
                points: result.points,
                reasons: result.reasons,
                scored: true,
            },
            { upsert: true, new: true }
        );


        // 2️⃣ Update contributor points
        await Contributor.findOneAndUpdate(
            { githubUsername: pr.user.login },
            {
                $inc: {
                    totalPoints: result.points,
                    totalPRs: 1,
                },
            },
            { upsert: true }
        );

        console.log(`🏅 Points assigned to ${pr.user.login}: +${result.points}`);


        console.log("🎯 PR Scored:", {
            pr: pr.number,
            level: result.level,
            points: result.points,
        });

        return {
            prNumber: pr.number,
            ...result,
        };
    },
    { connection: redis }
);

export default prWorker;
