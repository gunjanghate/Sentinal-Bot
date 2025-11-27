export const runScorer = (pr, files) => {
  // For demo, simple scoring:
  const points = pr.additions > 20 ? 10 : 3;

  return {
    level: points > 5 ? "L2" : "L1",
    points,
  };
};
