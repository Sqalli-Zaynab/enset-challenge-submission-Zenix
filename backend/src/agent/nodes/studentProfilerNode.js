import { buildStudentProfile, getProfileSummary } from "../../services/student-profiler.service.js";

export async function studentProfilerNode(state) {
  const profile = await buildStudentProfile(state.messages || [], state.studentProfile || {});

  return {
    studentProfile: profile,
    studentSummary: getProfileSummary(profile),
    trace: [
      `StudentProfiler: completeness=${profile.completenessScore}`,
      `StudentProfiler: missing=${profile.missing.join(",") || "none"}`,
    ],
  };
}