export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type CareerClarity = 'i_dont_know' | 'some_ideas' | 'i_know';

export type MainChallenge =
  | 'i_dont_know_what_fits_me'
  | 'i_dont_know_how_to_reach_my_goal'
  | 'i_cant_find_opportunities';

export type OpportunityType =
  | 'hackathons'
  | 'internships'
  | 'bootcamps'
  | 'projects';

export type PreferredLocation = 'local' | 'remote' | 'international';

export type AcademicLevel =
  | 'high_school'
  | 'undergraduate'
  | 'graduate'
  | 'self_taught'
  | 'bootcamp_certificate';

export type WorkValue =
  | 'impact'
  | 'growth'
  | 'stability'
  | 'creativity'
  | 'freedom'
  | 'challenge'
  | 'innovation';

export interface ProfileDraft {
  passions: string[];
  interests: string[];
  causes: string[];
  strengths: string[];
  academicLevel: AcademicLevel | null;
  fieldOfStudy: string;
  skillLevel: SkillLevel | null;
  personalGoal: string;
  careerClarity: CareerClarity | null;
  mainChallenge: MainChallenge | null;
  values: WorkValue[];
  opportunityTypes: OpportunityType[];
  preferredLocation: PreferredLocation | null;
}

export interface AnalyzeProfilePayload {
  passions: string[];
  interests: string[];
  causes: string[];
  strengths: string[];
  academicLevel: AcademicLevel;
  fieldOfStudy: string;
  skillLevel: SkillLevel;
  personalGoal: string;
  careerClarity: CareerClarity;
  mainChallenge: MainChallenge;
  values: WorkValue[];
  opportunityTypes: OpportunityType[];
  preferredLocation: PreferredLocation;
}

export interface NormalizedProfile extends AnalyzeProfilePayload {
  themes: string[];
  readiness: number;
}

export interface Diagnosis {
  recommendationMode: 'explore' | 'compare' | 'execute';
  mainNeed: string;
  summary: string;
  suggestedNextStep: string;
}

export interface CareerChoice {
  label: 'best_fit' | 'alternative' | 'safe_option';
  id: string;
  title: string;
  score: number;
  entryDifficulty: 'easy' | 'medium' | 'hard';
  shortDescription: string;
  reasons: string[];
  recommendedOpportunities: string[];
}

export interface CareerRecommendations {
  profileSummary: {
    themes: string[];
    readiness: number;
    careerClarity: string;
  };
  topChoices: CareerChoice[];
}

export interface OpportunityItem {
  id: number;
  title: string;
  type: string;
  location: string;
  tags: string[];
  description: string;
}

export interface StudyOption {
  program: string;
  school: string;
  city: string;
  link: string;
}

export interface PlanResult {
  selectedPath: {
    id: string;
    title: string;
    shortDescription: string;
  };
  roadmap: {
    first30Days: string[];
    next60Days: string[];
    next90Days: string[];
  };
  recommendedOpportunities: OpportunityItem[];
  studyOptions?: StudyOption[];
  explanation: string;
}

export interface ProfileAnalyzeResponse {
  profile: NormalizedProfile;
  diagnosis: Diagnosis;
  agentTrace: string[];
}

export interface CareerRecommendResponse {
  profile: NormalizedProfile;
  profileSummary: CareerRecommendations['profileSummary'];
  topChoices: CareerChoice[];
  agentTrace: string[];
}

export interface PlanGeneratePayload extends AnalyzeProfilePayload {
  selectedCareerId: string;
}

export interface PlanGenerateResponse extends PlanResult {
  profile: NormalizedProfile;
  agentTrace: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatCollectedInfo {
  fieldOfInterest?: string;
  goal?: string;
  academicLevel?: string;
  preferredRegion?: string;
  [key: string]: unknown;
}

export interface ChatCollectingResponse {
  status: 'collecting';
  response: string;
  messages: ChatMessage[];
  collectedInfo: ChatCollectedInfo;
  threadId?: string;
  agentTrace?: string[];
}

export interface ChatPlanReadyResponse {
  status: 'plan_ready';
  plan: Record<string, unknown>;
  messages: ChatMessage[];
  collectedInfo: ChatCollectedInfo;
  threadId?: string;
  agentTrace?: string[];
}

export interface ChatAwaitingApprovalResponse {
  status: 'awaiting_approval';
  pendingAction?: unknown;
  messages?: ChatMessage[];
  collectedInfo?: ChatCollectedInfo;
  threadId?: string;
  agentTrace?: string[];
}

export type ChatAdvisorResponse =
  | ChatCollectingResponse
  | ChatPlanReadyResponse
  | ChatAwaitingApprovalResponse;

export interface ProfileFlowState {
  draft: ProfileDraft;
  analyzedProfile: NormalizedProfile | null;
  diagnosis: Diagnosis | null;
  recommendations: CareerRecommendations | null;
  selectedCareerId: string | null;
  plan: PlanResult | null;
}

export const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  passions: [],
  interests: [],
  causes: [],
  strengths: [],
  academicLevel: null,
  fieldOfStudy: '',
  skillLevel: null,
  personalGoal: '',
  careerClarity: null,
  mainChallenge: null,
  values: [],
  opportunityTypes: [],
  preferredLocation: null,
};

export const EMPTY_PROFILE_FLOW_STATE: ProfileFlowState = {
  draft: EMPTY_PROFILE_DRAFT,
  analyzedProfile: null,
  diagnosis: null,
  recommendations: null,
  selectedCareerId: null,
  plan: null,
};
