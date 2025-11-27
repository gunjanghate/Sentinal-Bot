import axios from "axios";
import jwt from "jsonwebtoken";
import fs from "fs";
import { runScorer } from "./scorer.services.js";

export const processPRJob = async ({ installation_id, repo_owner, repo_name, pr_number, action }) => {
    console.log("🔍 Processing PR:", pr_number);

    const token = await getInstallationToken(installation_id);

    const pr = await axios.get(
        `https://api.github.com/repos/${repo_owner}/${repo_name}/pulls/${pr_number}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );

    // Fetch files
    const files = await axios.get(
        `https://api.github.com/repos/${repo_owner}/${repo_name}/pulls/${pr_number}/files`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    const score = runScorer(pr.data, files.data);

    console.log("🎯 Score:", score);

    // TODO: save to DB
};
