import crypto from "crypto";

export const verifyGitHubSignature = (req) => {
  const githubSignature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!githubSignature) {
    console.log("⚠️ No signature found in headers");
    return false;
  }

  if (!secret) {
    console.error("⚠️ GITHUB_WEBHOOK_SECRET is not configured; rejecting webhook");
    return false;
  }

  if (!req.rawBody) {
    console.error("⚠️ req.rawBody is missing; cannot verify signature");
    return false;
  }

  // Create HMAC-SHA256 hash using webhook secret
  const hmac = crypto.createHmac("sha256", secret);

  // GitHub creates signature using the RAW BODY (not parsed JSON)
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");

  // Compare GitHub’s signature with our computed signature (safe compare)
  const bufferGithub = Buffer.from(githubSignature, "utf8");
  const bufferDigest = Buffer.from(digest, "utf8");

  // Prevent timing attacks
  if (bufferGithub.length !== bufferDigest.length) {
    return false;
  }

  const isValid = crypto.timingSafeEqual(bufferGithub, bufferDigest);

  if (!isValid) {
    console.log("❌ Invalid webhook signature");
  }

  return isValid;
};
