export const runScorer = (pr, files) => {
  let score = 0;
  const reasons = [];

  // 1️⃣ Lines of Code (LOC)
  const locChanged = pr.additions + pr.deletions;

  if (locChanged > 200) {
    score += 30;
    reasons.push("Large code change (>200 LOC)");
  } else if (locChanged > 50) {
    score += 20;
    reasons.push("Medium code change (50–200 LOC)");
  } else {
    score += 10;
    reasons.push("Small code change (<50 LOC)");
  }

  // 2️⃣ Number of files changed
  if (files.length > 6) {
    score += 20;
    reasons.push("Many files modified (>10)");
  } else if (files.length > 3) {
    score += 10;
    reasons.push("Multiple files modified");
  }

  // 3️⃣ Detect test files
  const hasTests = files.some((file) =>
    /test|spec/i.test(file.filename)
  );

  if (hasTests) {
    score += 10;
    reasons.push("Includes test files");
  }

  // 4️⃣ Docs-only penalty
  const onlyDocs = files.every((file) =>
    file.filename.endsWith(".md")
  );

  if (onlyDocs) {
    score -= 15;
    reasons.push("Docs-only PR");
  }

  // 5️⃣ Final level mapping
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
