import { verifyGitHubSignature } from "../utils/verifyGitHubSignature.js";
import { prQueue } from "../queues/prQueue.js";

const EVENT_LABEL = "ECSoC26";

export const handleGitHubWebhook = async (req, res) => {
  try {
    // 1. Verify signature
    const isValid = verifyGitHubSignature(req);

    if (!isValid) {
      console.log("❌ Invalid signature - webhook rejected");
      return res.status(401).send("Invalid signature");
    }

    // 2. Identify the type of GitHub event
    const event = req.headers["x-github-event"];
    const payload = req.body || {};

    console.log(`📬 Webhook received: ${event} | action: ${payload.action}`);

    // 3. Only handle pull_request events for now
    if (event === "pull_request") {
      const installationId = payload?.installation?.id;
      const repoOwner = payload?.repository?.owner?.login;
      const repoName = payload?.repository?.name;
      const prNumber = payload?.number;

      // Case 1: PR closed via merge (existing behaviour preserved)
      if (payload.action === "closed" && payload.pull_request?.merged === true) {
        await prQueue.add("processPR", {
          installation_id: installationId,
          repo_owner: repoOwner,
          repo_name: repoName,
          pr_number: prNumber,
          action: payload.action,
        });

        console.log(
          `📨 Enqueued PR scoring job (event=closed, repo=${repoOwner}/${repoName}, pr=#${prNumber})`
        );
      }

      // Case 2: ECWoC label added (new behaviour)
      if (
        payload.action === "labeled" &&
        payload.label?.name === EVENT_LABEL
      ) {
        await prQueue.add("processPR", {
          installation_id: installationId,
          repo_owner: repoOwner,
          repo_name: repoName,
          pr_number: prNumber,
          action: payload.action,
        });

        console.log(
          `📨 Enqueued PR scoring job (event=labeled:${EVENT_LABEL}, repo=${repoOwner}/${repoName}, pr=#${prNumber})`
        );
      }
    }

    // Respond instantly to GitHub
    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Unexpected error handling GitHub webhook:", err);
    if (!res.headersSent) {
      return res.status(500).send("Internal server error");
    }
  }
};
