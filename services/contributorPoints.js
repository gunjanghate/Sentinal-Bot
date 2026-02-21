import Contributor from "../models/Contributor.js";


export const getContributorPoints = async (githubUsername) => {
    try {
        const contributor = await Contributor.findOne({ githubUsername });
        const points = contributor ? contributor.totalPoints : 0;

        console.log(`Fetched points for ${githubUsername}: ${points}`);
        return points;
    } catch (error) {
        console.error("Error fetching contributor points:", error);
        throw error;
    }
};