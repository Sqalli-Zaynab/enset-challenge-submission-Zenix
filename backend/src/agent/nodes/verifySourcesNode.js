export async function verifySourcesNode(state) {
  const raw = Array.isArray(state.rawSources) ? state.rawSources : [];

  const verifiedSources = raw
    .filter((item) => item.title && item.url)
    .map((item) => ({
      ...item,
      verification: item.official ? "official_or_academic_source" : "non_official_source",
      confidence: item.qualityScore >= 7 ? "high" : item.qualityScore >= 4 ? "medium" : "low",
    }))
    .slice(0, 6);

  return {
    verifiedSources,
    trace: [`VerifySources: kept=${verifiedSources.length}`],
  };
}