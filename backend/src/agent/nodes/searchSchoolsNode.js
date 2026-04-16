import { searchMoroccanUniversitiesForProfile } from "../../services/tavily.service.js";

export async function searchSchoolsNode(state) {
  const profile = state.studentProfile || {};
  const search = await searchMoroccanUniversitiesForProfile(profile);

  return {
    rawSources: search.results,
    searchQueries: search.queries,
    trace: [
      `SearchSchools: queries=${search.queries.length}`,
      `SearchSchools: results=${search.results.length}`,
      `SearchSchools: mock=${search.isMock}`,
    ],
  };
}