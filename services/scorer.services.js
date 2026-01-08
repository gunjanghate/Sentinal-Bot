/**
 * Rule-based PR Scorer
 *
 * Philosophy:
 * Score PRs based on EFFORT × BREADTH × QUALITY − NOISE
 * Then apply complexity-based caps to prevent gaming.
 */

export const runScorer = (pr, files) => {
  let score = 0;
  const reasons = [];

  // Only count added lines as "effort" to avoid rewarding large deletions
  const locAdded = pr.additions;
  const filesCount = files.length;
  const density = locAdded / Math.max(filesCount, 1);

  // -----------------------------
  // FILE TYPE ANALYSIS
  // -----------------------------

  const MARKUP_EXTENSIONS = [
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".yml"
  ];

  const isMarkupFile = (filename) =>
    MARKUP_EXTENSIONS.some((ext) =>
      filename.toLowerCase().endsWith(ext)
    );

  const isDocsOnly = files.every((file) =>
    file.filename.endsWith(".md")
  );

  const isMarkupOnly = files.every((file) =>
    isMarkupFile(file.filename)
  );

  const hasAnyMarkup = files.some((file) =>
    isMarkupFile(file.filename)
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
  if (locAdded > 250) {
    score += 25;
    reasons.push("High effort change (>250 added LOC)");
  } else if (locAdded >= 50) {
    score += 10;
    reasons.push("Moderate effort change (50–250 added LOC)");
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
  if (density < 5) {
    score -= 15;
    reasons.push("Low change density (many files, tiny changes)");
  } else if (density > 20) {
    score += 8;
    reasons.push("High change density (substantial work per file)");
  }

  // -----------------------------
  // 4️⃣ FEATURE SIGNAL: New files
  // -----------------------------
  const newFilesCount = files.filter(
    (file) => file.status === "added"
  ).length;

  if (newFilesCount >= 2) {
    score += 8;
    reasons.push("Introduces new files (feature-level change)");
  }

  // -----------------------------
  // 5️⃣ QUALITY SIGNAL: Tests
  // -----------------------------
  const meaningfulTests = files.some(
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
    score -= 20;
    reasons.push(
      "Contains HTML/CSS alongside code; adjusted to reduce styling-dominated score"
    );
  }


  // -----------------------------
  // 7️⃣ FINAL LEVEL MAPPING
  // -----------------------------
  let level, points;

  if (score >= 55) {
    level = "L3";
    points = 10;
  } else if (score >= 30) {
    level = "L2";
    points = 7;
  } else {
    level = "L1";
    points = 3;
  }


  // -----------------------------
  // 8️⃣ COMPLEXITY CAP: HTML/CSS-only
  // -----------------------------
  if (isMarkupOnly && level === "L3") {
    level = "L2";
    points = 7;
    reasons.push(
      "HTML/CSS-only changes capped at L2 due to low system complexity"
    );
  }

  return {
    score,
    level,
    points,
    reasons,
  };
};
