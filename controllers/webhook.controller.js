import { verifyGitHubSignature } from "../utils/verifyGitHubSignature.js";
import { prQueue } from "../queues/prQueue.js";

export const handleGitHubWebhook = async (req, res) => {
  if (!verifyGitHubSignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.headers["x-github-event"];

  const payload = req.body;
  console.log("📬 Webhook Payload:", payload);

  console.log("📬 Webhook Event:", event, "Action:", payload.action);

  if (event === "pull_request") {
    const jobData = {
      installation_id: payload.installation.id,
      repo_owner: payload.repository.owner.login,
      repo_name: payload.repository.name,
      pr_number: payload.number,
      action: payload.action,
    };

    await prQueue.add("processPR", jobData);
  }

  return res.status(200).send("OK");
};
