import jwt from "jsonwebtoken";
import fs from "fs";
import axios from "axios";
import path from "path";

const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH; // .pem file path
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const APP_ID = process.env.GITHUB_APP_ID;

/**
 * 1️⃣ Create a JWT that represents the GitHub App itself
 */
export const createAppJWT = () => {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iat: now - 60,        // issued 1 min ago (clock drift safe)
    exp: now + 9 * 60,    // valid for 9 minutes
    iss: APP_ID,         // GitHub App ID
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
};

/**
 * 2️⃣ Exchange JWT for an Installation Access Token
 */
export const getInstallationAccessToken = async (installationId) => {
  const appJWT = createAppJWT();

  const response = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return response.data.token;
};



// import axios from "axios";
// import jwt from "jsonwebtoken";
// import fs from "fs";
// import { runScorer } from "./scorer.services.js";

// export const processPRJob = async ({ installation_id, repo_owner, repo_name, pr_number, action }) => {
//     console.log("🔍 Processing PR:", pr_number);

//     const token = await getInstallationToken(installation_id);

//     const pr = await axios.get(
//         `https://api.github.com/repos/${repo_owner}/${repo_name}/pulls/${pr_number}`,
//         { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
//     );

//     // Fetch files
//     const files = await axios.get(
//         `https://api.github.com/repos/${repo_owner}/${repo_name}/pulls/${pr_number}/files`,
//         { headers: { Authorization: `Bearer ${token}` } }
//     );

//     const score = runScorer(pr.data, files.data);

//     console.log("🎯 Score:", score);

//     // TODO: save to DB
// };
