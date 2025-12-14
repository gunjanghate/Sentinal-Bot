import axios from "axios";
import { getInstallationAccessToken } from "./github.services.js";

/**
 * Fetch PR details (metadata)
 */
export const fetchPullRequest = async ({
    installationId,
    owner,
    repo,
    prNumber,
}) => {
    try {
        const token = await getInstallationAccessToken(installationId);

        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                },
            }
        );

        return response.data;
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;
            throw new Error(
                `Failed to fetch pull request ${owner}/${repo}#${prNumber}: ${status} ${data?.message ?? JSON.stringify(data)}`
            );
        }
        throw new Error(`Failed to fetch pull request: ${error.message}`);
    }
};

/**
 * Fetch PR files (diff info)
 */
export const fetchPullRequestFiles = async ({
    installationId,
    owner,
    repo,
    prNumber,
}) => {
    try {
        const token = await getInstallationAccessToken(installationId);

        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                },
            }
        );

        return response.data;
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;
            throw new Error(
                `Failed to fetch pull request files ${owner}/${repo}#${prNumber}: ${status} ${data?.message ?? JSON.stringify(data)}`
            );
        }
        throw new Error(`Failed to fetch pull request files: ${error.message}`);
    }
};
