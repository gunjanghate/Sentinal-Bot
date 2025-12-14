import { verifyGitHubSignature } from "../utils/verifyGitHubSignature.js";
import { prQueue } from "../queues/prQueue.js";

export const handleGitHubWebhook = async (req, res) => {
  // 1. Verify signature
  const isValid = verifyGitHubSignature(req);

  if (!isValid) {
    console.log("❌ Invalid signature - webhook rejected");
    return res.status(401).send("Invalid signature");
  }

  // 2. Identify the type of GitHub event
  const event = req.headers["x-github-event"];
  const payload = req.body;

  console.log(`📬 Webhook received: ${event} | action: ${payload.action}`);

  // 3. Only handle pull_request events for now
  if (event === "pull_request" && payload.action === "closed" &&
    payload.pull_request.merged === true) {
    const installationId = payload?.installation?.id;
    const repoOwner = payload?.repository?.owner?.login;
    const repoName = payload?.repository?.name;
    const prNumber = payload?.number;

    // Send PR event to Redis queue
    await prQueue.add("processPR", {
      installation_id: installationId,
      repo_owner: repoOwner,
      repo_name: repoName,
      pr_number: prNumber,
      action: payload.action,
    });

    console.log("📨 PR job added to queue");
  }

  // Respond instantly to GitHub
  return res.status(200).send("OK");
};
