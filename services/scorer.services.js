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

  const locChanged = pr.additions + pr.deletions;
  const filesCount = files.length;
  const density = locChanged / Math.max(filesCount, 1);

  // -----------------------------
  // FILE TYPE ANALYSIS
  // -----------------------------

  const MARKUP_EXTENSIONS = [
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
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
  if (locChanged > 200) {
    score += 30;
    reasons.push("High effort change (>200 LOC)");
  } else if (locChanged >= 50) {
    score += 20;
    reasons.push("Moderate effort change (50–200 LOC)");
  } else {
    score += 10;
    reasons.push("Low effort change (<50 LOC)");
  }

  // -----------------------------
  // 2️⃣ BREADTH: Files changed
  // -----------------------------
  if (filesCount >= 5) {
    score += 20;
    reasons.push("Broad change across multiple files (5+)");
  } else if (filesCount >= 2) {
    score += 10;
    reasons.push("Multi-file change");
  }

  // -----------------------------
  // 3️⃣ ANTI-SPAM: Density
  // -----------------------------
  if (density < 5) {
    score -= 15;
    reasons.push("Low change density (many files, tiny changes)");
  } else if (density > 20) {
    score += 10;
    reasons.push("High change density (substantial work per file)");
  }

  // -----------------------------
  // 4️⃣ FEATURE SIGNAL: New files
  // -----------------------------
  const newFilesCount = files.filter(
    (file) => file.status === "added"
  ).length;

  if (newFilesCount >= 2) {
    score += 10;
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
  // 6️⃣ FINAL LEVEL MAPPING
  // -----------------------------
  let level, points;

  if (score >= 50) {
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
  // 7️⃣ COMPLEXITY CAP: HTML/CSS-only
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
