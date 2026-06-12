/**
 * Rule-based PR Scorer
 *
 * Philosophy:
 * Score PRs based on EFFORT × BREADTH × QUALITY − NOISE
 * Then apply complexity-based caps to prevent gaming.
 */

const BONUS_START = new Date("2026-02-22T12:00:00.000Z");
const BONUS_END = new Date("2026-02-28T23:59:59.999Z");

const isInBonusWindow = (now = new Date()) =>
// now >= BONUS_START && now <= BONUS_END;
{
  return true;
}

export const runScorer = (pr, files, contributorPoints) => {
  let score = 0;
  const reasons = [];

  const safeFiles = Array.isArray(files) ? files : [];

  // Only count added lines as "effort" to avoid rewarding large deletions
  const locAdded =
    pr && typeof pr.additions === "number" ? pr.additions : 0;
  const filesCount = safeFiles.length;
  const density = filesCount === 0 ? 0 : locAdded / filesCount;

  // No files at all is treated as invalid input
  if (filesCount === 0) {
    return {
      score: 0,
      level: "INVALID",
      points: 0,
      reasons: ["No files found in PR; PR marked INVALID"],
    };
  }

  // -----------------------------
  // HARD GATE: No additions => INVALID
  // -----------------------------
  if (locAdded === 0) {
    return {
      score: 0,
      level: "INVALID",
      points: 0,
      reasons: ["No added lines; PR marked INVALID"],
    };
  }

  // -----------------------------
  // FILE TYPE ANALYSIS
  // -----------------------------

  const MARKUP_EXTENSIONS = [
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".yml",
    ".json",
    ".txt"
  ];

  const isMarkupFile = (filename) =>
    MARKUP_EXTENSIONS.some((ext) =>
      filename.toLowerCase().endsWith(ext)
    );

  const isDocsOnly = safeFiles.every((file) =>
    (file?.filename || "").endsWith(".md")
  );

  const isMarkupOnly = safeFiles.every((file) =>
    isMarkupFile(file?.filename || "")
  );

  const hasAnyMarkup = safeFiles.some((file) =>
    isMarkupFile(file?.filename || "")
  );

  // -----------------------------
  // HARD GATE: Docs-only
  // -----------------------------
  if (isDocsOnly) {
    return {
      score: 10,
      level: "L1",
      points: 3,
      reasons: ["Docs-only PR (capped at L1)"],
    };
  }

  // -----------------------------
  // 1️⃣ EFFORT: LOC
  // -----------------------------
  if (locAdded > 300) {
    score += 20;
    reasons.push("High effort change (>300 added LOC)");
  } else if (locAdded >= 50) {
    score += 10;
    reasons.push("Moderate effort change (50–300 added LOC)");
  } else {
    score += 5;
    reasons.push("Low effort change (<50 added LOC)");
  }

  // -----------------------------
  // 2️⃣ BREADTH: Files changed
  // -----------------------------
  if (filesCount >= 5) {
    score += 15;
    reasons.push("Broad change across multiple files (5+)");
  } else if (filesCount >= 2) {
    score += 8;
    reasons.push("Multi-file change");
  }

  // -----------------------------
  // 3️⃣ ANTI-SPAM: Density
  // -----------------------------
  if (density < 4) {
    score -= 15;
    reasons.push("Low change density (many files, tiny changes)");
  } else if (density > 20) {
    score += 10;
    reasons.push("High change density (substantial work per file)");
  }

  // -----------------------------
  // 4️⃣ FEATURE SIGNAL: New files
  // -----------------------------
  const newFilesCount = safeFiles.filter(
    (file) => file.status === "added"
  ).length;

  if (newFilesCount >= 2) {
    score += 8;
    reasons.push("Introduces new files (feature-level change)");
  }

  // -----------------------------
  // 5️⃣ QUALITY SIGNAL: Tests
  // -----------------------------
  const meaningfulTests = safeFiles.some(
    (file) =>
      /test|spec/i.test(file.filename) &&
      file.additions >= 10
  );

  if (meaningfulTests) {
    score += 10;
    reasons.push("Includes meaningful test coverage");
  }


  // -----------------------------
  // 6️⃣ MARKUP DILUTION ADJUSTMENT
  // -----------------------------
  if (hasAnyMarkup && !isMarkupOnly) {
    score -= 10;
    reasons.push(
      "Contains HTML/CSS alongside code; adjusted to reduce styling-dominated score"
    );
  }
  if (isMarkupOnly) {
    score -= 20;
    reasons.push(
      "HTML/CSS-only changes; adjusted to reduce styling-dominated score"
    );
  }


  // -----------------------------
  // 7️⃣ FINAL LEVEL MAPPING
  // -----------------------------
  let level, points;
  const bonusActive = isInBonusWindow();

  // Tier 1: 0 – 500 points → 2.0x
  // Tier 2: 501 – 1000 points → 1.75x
  // Tier 3: 1001 – 2000 points → 1.5x
  // Tier 4: 2001 – 4000 points → 1.25x
  // Tier 5: 4000+ points → 1.1x
  const baseMultiplier = contributorPoints >= 4000 ? 1.1 :
    contributorPoints >= 2001 ? 1.25 :
      contributorPoints >= 1001 ? 1.5 :
        contributorPoints >= 501 ? 1.75 : 2.0;

  const multiplier = bonusActive ? baseMultiplier : 1.0;

  // if (score >= 50) {
  //   level = "L3";
  //   points = 10 * multiplier;
  // } else if (score >= 30) {
  //   level = "L2";
  //   points = 7 * multiplier;
  // } else {
  //   level = "L1";
  //   points = 3 * multiplier;
  // }
  if (score >= 50) {
    level = "L3";
    points = 50 ;
  } else if (score >= 30) {
    level = "L2";
    points = 100 ;
  } else {
    level = "L1";
    points = 150 ;
  }


  // -----------------------------
  // 8️⃣ COMPLEXITY CAP: HTML/CSS-only
  // -----------------------------
  if (isMarkupOnly && level === "L3") {
    level = "L2";
    points = 100 ;
    reasons.push(
      "HTML/CSS-only changes capped at L2 due to low system complexity"
    );
  }

  return {
    score,
    level,
    points,
    reasons,
    bonusApplied: bonusActive,
  };
};
