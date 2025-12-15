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

        const allFiles = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const response = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json",
                    },
                    params: {
                        per_page: perPage,
                        page,
                    },
                    // Prevent hanging forever on slow/unresponsive GitHub
                    timeout: 10_000,
                }
            );

            const pageFiles = response.data ?? [];

            if (!Array.isArray(pageFiles) || pageFiles.length === 0) {
                break;
            }

            allFiles.push(...pageFiles);

            // If fewer than perPage files returned, we've reached the end.
            if (pageFiles.length < perPage) {
                break;
            }

            page += 1;
        }

        return allFiles;
    } catch (error) {
        if (error.response) {
            const { status, data } = error.response;
            throw new Error(
                `Failed to fetch pull request files ${owner}/${repo}#${prNumber}: ${status} ${data?.message ?? JSON.stringify(data)}`
            );
        }
        if (error.code === "ECONNABORTED") {
            throw new Error(
                `Timed out fetching pull request files ${owner}/${repo}#${prNumber}`
            );
        }

        throw new Error(`Failed to fetch pull request files: ${error.message}`);
    }
};
