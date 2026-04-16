function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

export function isOfficialAcademicSource(url = "") {
  const u = normalize(url);
  return (
    u.includes(".ac.ma") ||
    u.includes("ensa") ||
    u.includes("encg") ||
    u.includes("ens") ||
    u.includes("emi") ||
    u.includes("um5") ||
    u.includes("uca") ||
    u.includes("usmba") ||
    u.includes("uh2c") ||
    u.includes("uha") ||
    u.includes("uae") ||
    u.includes("universite") ||
    u.includes("univ-")
  );
}export function normalizeSearchResults(raw = []) {
  const items = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];

  return items
    .map((item, index) => ({
      id: `source_${index + 1}`,
      title: item.title || "Untitled source",
      url: item.url || item.link || "",
      snippet: item.content || item.snippet || item.body || "",
      score: typeof item.score === "number" ? item.score : 0,
      official: isOfficialAcademicSource(item.url || item.link || ""),
    }))
    .filter((item) => item.title || item.url || item.snippet);
}export function rankSources(results = [], profile = {}) {
  const city = normalize(profile.preferredRegion || "");
  const field = normalize(profile.fieldOfInterest || "");

  return [...results]
    .map((item) => {
      let quality = item.score || 0;
      const hay = normalize(`${item.title} ${item.snippet}`);

      if (item.official) quality += 4;
      if (city && hay.includes(city)) quality += 2;
      if (field && hay.includes(field)) quality += 2;
      if (hay.includes("admission")) quality += 1;
      if (hay.includes("concours")) quality += 1;
      if (hay.includes("inscription")) quality += 1;
      if (hay.includes("frais")) quality += 1;
      if (hay.includes("programme")) quality += 1;

      return { ...item, qualityScore: quality };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);
}export function dedupeSources(results = []) {
  const map = new Map();
  for (const item of results) {
    const key = item.url || `${item.title}-${item.snippet.slice(0, 100)}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}