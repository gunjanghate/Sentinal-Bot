/**
 * Rule-based PR Scorer
 *
 * Philosophy:
 * Score PRs based on EFFORT × BREADTH × QUALITY − NOISE
 *
 * This avoids fragile assumptions like "frontend vs backend"
 * and instead focuses on universally observable signals.
 */

export const runScorer = (pr, files) => {
  let score = 0;
  const reasons = [];

  // -----------------------------
  // BASIC METRICS
  // -----------------------------

  const locChanged = pr.additions + pr.deletions;
  const filesCount = files.length;

  // Change density helps detect spam:
  // touching many files with tiny changes is low-effort noise
  const density = locChanged / Math.max(filesCount, 1);

  // -----------------------------
  // 1️⃣ HARD GATE: Docs-only PR
  // -----------------------------
  // Docs-only PRs are valuable, but should not compete
  // with code contributions in OSS events.
  const isDocsOnly = files.every((file) =>
    file.filename.endsWith(".md")
  );

  if (isDocsOnly) {
    return {
      score: 10,
      level: "L1",
      points: 3,
      reasons: ["Docs-only PR (capped at L1)"],
    };
  }

  // -----------------------------
  // 2️⃣ EFFORT: Lines of Code
  // -----------------------------
  // LOC is a rough but stack-agnostic proxy for effort.
  if (locChanged > 150) {
    score += 30;
    reasons.push("High effort change (>150 LOC)");
  } else if (locChanged >= 40) {
    score += 20;
    reasons.push("Moderate effort change (40–150 LOC)");
  } else {
    score += 10;
    reasons.push("Low effort change (<40 LOC)");
  }

  // -----------------------------
  // 3️⃣ BREADTH: Files changed
  // -----------------------------
  // More files usually indicate broader impact or integration work.
  if (filesCount >= 5) {
    score += 20;
    reasons.push("Broad change across multiple files (5+)");
  } else if (filesCount >= 2) {
    score += 10;
    reasons.push("Multi-file change");
  }

  // -----------------------------
  // 4️⃣ ANTI-SPAM: Change density
  // -----------------------------
  // Prevents gaming by touching many files with trivial edits.
  if (density < 5) {
    score -= 15;
    reasons.push("Low change density (many files, tiny changes)");
  } else if (density > 20) {
    score += 10;
    reasons.push("High change density (substantial work per file)");
  }

  // -----------------------------
  // 5️⃣ FEATURE SIGNAL: New files
  // -----------------------------
  // Adding new files often indicates new functionality.
  const newFilesCount = files.filter(
    (file) => file.status === "added"
  ).length;

  if (newFilesCount >= 2) {
    score += 10;
    reasons.push("Introduces new files (feature-level change)");
  }

  // -----------------------------
  // 6️⃣ QUALITY SIGNAL: Tests
  // -----------------------------
  // Tests only count if they have meaningful additions
  // (prevents fake test files with no content).
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
  // 7️⃣ FINAL LEVEL MAPPING
  // -----------------------------
  // Levels require multiple strong signals to avoid abuse.
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

  return {
    score,
    level,
    points,
    reasons,
  };
};
