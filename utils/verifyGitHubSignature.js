import crypto from "crypto";

export const verifyGitHubSignature = (req) => {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature || ""),
    Buffer.from(digest)
  );
};
