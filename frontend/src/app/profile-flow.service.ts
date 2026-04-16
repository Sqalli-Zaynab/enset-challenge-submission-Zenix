import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  AnalyzeProfilePayload,
  CareerChoice,
  CareerRecommendations,
  CareerRecommendResponse,
  ChatAdvisorResponse,
  ChatCollectedInfo,
  ChatMessage,
  Diagnosis,
  EMPTY_PROFILE_DRAFT,
  EMPTY_PROFILE_FLOW_STATE,
  NormalizedProfile,
  OpportunityItem,
  PlanGeneratePayload,
  PlanGenerateResponse,
  PlanResult,
  ProfileAnalyzeResponse,
  ProfileDraft,
  ProfileFlowState,
  StudyOption,
  WorkValue,
} from './profile-flow.types';

type ArrayDraftField = {
  [K in keyof ProfileDraft]: ProfileDraft[K] extends string[] ? K : never;
}[keyof ProfileDraft];

const STORAGE_KEY = 'afaq.profile-flow.draft';
const RESULT_STORAGE_KEY = 'afaq.profile-flow.result';

type PersistedResultState = Omit<ProfileFlowState, 'draft'>;

const EMPTY_PERSISTED_RESULT_STATE: PersistedResultState = {
  analyzedProfile: null,
  diagnosis: null,
  recommendations: null,
  selectedCareerId: null,
  plan: null,
};

@Injectable({ providedIn: 'root' })
export class ProfileFlowService {
  private readonly apiBaseUrl = '/api';

  private readonly state = signal<ProfileFlowState>({
    ...EMPTY_PROFILE_FLOW_STATE,
    draft: this.loadDraft(),
    ...this.loadResultState(),
  });

  readonly draft = computed(() => this.state().draft);
  readonly analyzedProfile = computed(() => this.state().analyzedProfile);
  readonly diagnosis = computed(() => this.state().diagnosis);
  readonly recommendations = computed(() => this.state().recommendations);
  readonly selectedCareerId = computed(() => this.state().selectedCareerId);
  readonly plan = computed(() => this.state().plan);

  readonly isSubmitting = signal(false);
  readonly isGeneratingPlan = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly planError = signal<string | null>(null);
  readonly analysisTrace = signal<string[]>([]);
  readonly recommendationTrace = signal<string[]>([]);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly chatCollectedInfo = signal<ChatCollectedInfo>({});
  readonly currentQuestion = signal<string>('');
  readonly chatThreadId = signal<string | null>(null);
  readonly isChatLoading = signal(false);
  readonly chatError = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  clearSubmitFeedback(): void {
    this.submitError.set(null);
  }

  clearPlanFeedback(): void {
    this.planError.set(null);
  }

  updateDraftField<K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ): void {
    this.patchDraft({ [key]: value } as Pick<ProfileDraft, K>);
  }

  updateListField(key: ArrayDraftField, rawValue: string): void {
    this.patchDraft({
      [key]: this.parseStringList(rawValue),
    } as Pick<ProfileDraft, ArrayDraftField>);
  }

  toggleArrayValue<K extends ArrayDraftField>(
    key: K,
    value: ProfileDraft[K][number],
    checked: boolean,
  ): void {
    const current = this.draft()[key] as string[];
    const next = checked
      ? Array.from(new Set([...current, value as string]))
      : current.filter((item) => item !== value);

    this.patchDraft({
      [key]: next,
    } as Pick<ProfileDraft, K>);
  }

  getListFieldText(key: ArrayDraftField): string {
    return (this.draft()[key] as string[]).join(', ');
  }

  saveDraft(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.draft()));
  }

  resetFlow(): void {
    this.state.set({
      ...EMPTY_PROFILE_FLOW_STATE,
      draft: { ...EMPTY_PROFILE_DRAFT },
    });
    this.isSubmitting.set(false);
    this.isGeneratingPlan.set(false);
    this.submitError.set(null);
    this.planError.set(null);
    this.analysisTrace.set([]);
    this.recommendationTrace.set([]);
    this.resetDynamicInterview();
    this.clearDraftStorage();
    this.clearResultStorage();
  }

  async startDynamicInterview(): Promise<void> {
    this.resetDynamicInterview();
    await this.requestChatTurn('');
  }

  async continueDynamicInterview(answer: string): Promise<'collecting' | 'plan_ready'> {
    const response = await this.requestChatTurn(answer);

    if (response.status === 'collecting') {
      return 'collecting';
    }

    return 'plan_ready';
  }

  applyDynamicInfoToDraft(): void {
    const info = this.chatCollectedInfo();
    const currentDraft = this.draft();

    const fieldOfInterest =
      typeof info.fieldOfInterest === 'string' ? info.fieldOfInterest.trim() : '';
    const goal = typeof info.goal === 'string' ? info.goal.trim() : '';
    const academicLevelRaw =
      typeof info.academicLevel === 'string' ? info.academicLevel.trim().toLowerCase() : '';
    const preferredRegionRaw =
      typeof info.preferredRegion === 'string' ? info.preferredRegion.trim().toLowerCase() : '';

    const academicLevel = this.toAcademicLevel(academicLevelRaw);
    const preferredLocation = this.toPreferredLocation(preferredRegionRaw);

    this.patchDraft({
      passions: currentDraft.passions.length ? currentDraft.passions : fieldOfInterest ? [fieldOfInterest] : [],
      interests: currentDraft.interests.length ? currentDraft.interests : fieldOfInterest ? [fieldOfInterest] : [],
      causes: currentDraft.causes,
      strengths: currentDraft.strengths,
      academicLevel: currentDraft.academicLevel ?? academicLevel,
      fieldOfStudy: currentDraft.fieldOfStudy.trim() || fieldOfInterest,
      skillLevel: currentDraft.skillLevel,
      personalGoal: currentDraft.personalGoal.trim() || goal,
      careerClarity: currentDraft.careerClarity,
      mainChallenge: currentDraft.mainChallenge,
      values: currentDraft.values,
      opportunityTypes: currentDraft.opportunityTypes,
      preferredLocation: currentDraft.preferredLocation ?? preferredLocation,
    });

    this.saveDraft();
  }

  resetDynamicInterview(): void {
    this.chatMessages.set([]);
    this.chatCollectedInfo.set({});
    this.currentQuestion.set('');
    this.chatThreadId.set(null);
    this.isChatLoading.set(false);
    this.chatError.set(null);
  }

  setSelectedCareerId(careerId: string | null): void {
    this.state.update((state) => ({
      ...state,
      selectedCareerId: careerId,
    }));
    this.saveResultState();
  }

  getAnalyzePayload(): AnalyzeProfilePayload {
    const draft = this.draft();

    return {
      passions: draft.passions,
      interests: draft.interests,
      causes: draft.causes,
      strengths: draft.strengths,
      academicLevel: draft.academicLevel ?? 'undergraduate',
      fieldOfStudy: draft.fieldOfStudy.trim(),
      skillLevel: draft.skillLevel ?? 'beginner',
      personalGoal: draft.personalGoal.trim(),
      careerClarity: draft.careerClarity ?? 'i_dont_know',
      mainChallenge: draft.mainChallenge ?? 'i_dont_know_what_fits_me',
      values: draft.values,
      opportunityTypes: draft.opportunityTypes,
      preferredLocation: draft.preferredLocation ?? 'remote',
    };
  }

  getRecommendPayload(): AnalyzeProfilePayload {
    const normalizedProfile = this.analyzedProfile();

    if (!normalizedProfile) {
      return this.getAnalyzePayload();
    }

    return this.pickAnalyzePayload(normalizedProfile);
  }

  getPlanPayload(): PlanGeneratePayload | null {
    const normalizedProfile = this.analyzedProfile();
    const selectedCareerId = this.selectedCareerId();

    if (!normalizedProfile || !selectedCareerId) {
      return null;
    }

    return {
      ...this.pickAnalyzePayload(normalizedProfile),
      selectedCareerId,
    };
  }

  async analyzeAndRecommend(): Promise<void> {
    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.planError.set(null);

    try {
      const analyzeResponse = await firstValueFrom(
        this.http.post<ProfileAnalyzeResponse>(
          `${this.apiBaseUrl}/profile/analyze`,
          this.getAnalyzePayload(),
        ),
      );

      this.analysisTrace.set(analyzeResponse.agentTrace ?? []);

      this.state.update((state) => ({
        ...state,
        analyzedProfile: analyzeResponse.profile,
        diagnosis: analyzeResponse.diagnosis,
        plan: null,
      }));
      this.saveResultState();

      const recommendResponse = await firstValueFrom(
        this.http.post<CareerRecommendResponse>(
          `${this.apiBaseUrl}/career/recommend`,
          this.pickAnalyzePayload(analyzeResponse.profile),
        ),
      );

      this.recommendationTrace.set(recommendResponse.agentTrace ?? []);

      this.state.update((state) => ({
        ...state,
        recommendations: {
          profileSummary: recommendResponse.profileSummary,
          topChoices: recommendResponse.topChoices,
        },
        selectedCareerId:
          state.selectedCareerId ?? recommendResponse.topChoices[0]?.id ?? null,
      }));
      this.saveResultState();

      this.saveDraft();
    } catch (error) {
      console.error('Profile flow submission failed:', error);
      this.submitError.set(this.getSubmissionErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async generatePlan(careerId: string): Promise<void> {
    const normalizedProfile = this.analyzedProfile();

    if (!normalizedProfile || !careerId) {
      return;
    }

    this.isGeneratingPlan.set(true);
    this.planError.set(null);

    this.state.update((state) => ({
      ...state,
      selectedCareerId: careerId,
      plan: state.plan?.selectedPath.id === careerId ? state.plan : null,
    }));
    this.saveResultState();

    try {
      const payload: PlanGeneratePayload = {
        ...this.pickAnalyzePayload(normalizedProfile),
        selectedCareerId: careerId,
      };

      const response = await firstValueFrom(
        this.http.post<PlanGenerateResponse>(
          `${this.apiBaseUrl}/plan/generate`,
          payload,
        ),
      );

      this.state.update((state) => ({
        ...state,
        analyzedProfile: response.profile,
        selectedCareerId: careerId,
        plan: {
          selectedPath: response.selectedPath,
          roadmap: response.roadmap,
          recommendedOpportunities: response.recommendedOpportunities,
          studyOptions: response.studyOptions ?? [],
          explanation: response.explanation,
        },
      }));
      this.saveResultState();
    } catch (error) {
      console.error('Plan generation failed:', error);
      this.planError.set(this.getPlanErrorMessage(error));
    } finally {
      this.isGeneratingPlan.set(false);
    }
  }

  private patchDraft(patch: Partial<ProfileDraft>): void {
    let didChange = false;

    this.state.update((state) => {
      const keys = Object.keys(patch) as Array<keyof ProfileDraft>;

      didChange = keys.some((key) =>
        !this.areDraftValuesEqual(state.draft[key], patch[key] as ProfileDraft[typeof key]),
      );

      if (!didChange) {
        return state;
      }

      return {
        ...state,
        draft: {
          ...state.draft,
          ...patch,
        },
        analyzedProfile: null,
        diagnosis: null,
        recommendations: null,
        selectedCareerId: null,
        plan: null,
      };
    });

    if (didChange) {
      this.analysisTrace.set([]);
      this.recommendationTrace.set([]);
      this.submitError.set(null);
      this.planError.set(null);
      this.clearResultStorage();
    }
  }

  private loadDraft(): ProfileDraft {
    if (typeof localStorage === 'undefined') {
      return { ...EMPTY_PROFILE_DRAFT };
    }

    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.draft');

      if (!raw) {
        return { ...EMPTY_PROFILE_DRAFT };
      }

      const parsed = JSON.parse(raw) as Partial<ProfileDraft>;

      return {
        ...EMPTY_PROFILE_DRAFT,
        ...parsed,
        passions: this.ensureStringArray(parsed.passions),
        interests: this.ensureStringArray(parsed.interests),
        causes: this.ensureStringArray(parsed.causes),
        strengths: this.ensureStringArray(parsed.strengths),
        values: this.ensureStringArray(parsed.values) as WorkValue[],
        opportunityTypes: this.ensureStringArray(parsed.opportunityTypes) as ProfileDraft['opportunityTypes'],
      };
    } catch {
      return { ...EMPTY_PROFILE_DRAFT };
    }
  }

  private loadResultState(): PersistedResultState {
    if (typeof localStorage === 'undefined') {
      return { ...EMPTY_PERSISTED_RESULT_STATE };
    }

    try {
      const raw =
        localStorage.getItem(RESULT_STORAGE_KEY) ??
        localStorage.getItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.result');

      if (!raw) {
        return { ...EMPTY_PERSISTED_RESULT_STATE };
      }

      const parsed = JSON.parse(raw) as Partial<PersistedResultState>;

      return {
        analyzedProfile: this.sanitizeNormalizedProfile(parsed.analyzedProfile),
        diagnosis: this.sanitizeDiagnosis(parsed.diagnosis),
        recommendations: this.sanitizeRecommendations(parsed.recommendations),
        selectedCareerId:
          typeof parsed.selectedCareerId === 'string'
            ? parsed.selectedCareerId
            : null,
        plan: this.sanitizePlan(parsed.plan),
      };
    } catch {
      return { ...EMPTY_PERSISTED_RESULT_STATE };
    }
  }

  private pickAnalyzePayload(profile: AnalyzeProfilePayload): AnalyzeProfilePayload {
    return {
      passions: [...profile.passions],
      interests: [...profile.interests],
      causes: [...profile.causes],
      strengths: [...profile.strengths],
      academicLevel: profile.academicLevel,
      fieldOfStudy: profile.fieldOfStudy,
      skillLevel: profile.skillLevel,
      personalGoal: profile.personalGoal,
      careerClarity: profile.careerClarity,
      mainChallenge: profile.mainChallenge,
      values: [...profile.values],
      opportunityTypes: [...profile.opportunityTypes],
      preferredLocation: profile.preferredLocation,
    };
  }

  private parseStringList(rawValue: string): string[] {
    return rawValue
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private ensureStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }

 private async requestChatTurn(message: string): Promise<ChatAdvisorResponse> {
  this.isChatLoading.set(true);
  this.chatError.set(null);

  try {
    const payload: Record<string, unknown> = {
      message: (message ?? '').trim(),
    };

    const threadId = this.chatThreadId();
    if (typeof threadId === 'string' && threadId.trim()) {
      payload['threadId'] = threadId;
    }

    const response = await firstValueFrom(
      this.http.post<ChatAdvisorResponse>(`${this.apiBaseUrl}/chat/message`, payload),
    );

    if (typeof (response as any).threadId === 'string' && (response as any).threadId.trim()) {
      this.chatThreadId.set((response as any).threadId);
 }

    if (Array.isArray((response as any).messages)) {
      this.chatMessages.set(
        this.mergeChatMessages(this.chatMessages(), (response as any).messages),
      );
    }

    const profile =
      (response as any).studentProfile && this.isRecord((response as any).studentProfile)
        ? ((response as any).studentProfile as ChatCollectedInfo)
        : ((response as any).collectedInfo && this.isRecord((response as any).collectedInfo)
            ? ((response as any).collectedInfo as ChatCollectedInfo)
            : null);

    if (profile) {
      this.chatCollectedInfo.set(profile);
    }

    if ((response as any).status === 'collecting') {
      this.currentQuestion.set((response as any).response || 'Can you tell me more?');
    } else if ((response as any).status === 'plan_ready') {
      this.currentQuestion.set('');
    } else {
      this.currentQuestion.set('I am ready to continue. Share one more detail.');
    }

    return response;
  } catch (error) {
    console.error('Dynamic interview failed:', error);
    this.chatError.set('We could not get the next question right now. Please try again.');
    throw error;
  } finally {
    this.isChatLoading.set(false);
  }
}

  private mergeChatMessages(current: ChatMessage[], incoming: unknown): ChatMessage[] {
    if (!Array.isArray(incoming)) {
      return current;
    }

    const next = incoming
      .map((message) => ({
        role: message?.role,
        content: typeof message?.content === 'string' ? message.content.trim() : '',
      }))
      .filter(
        (message): message is ChatMessage =>
          (message.role === 'user' || message.role === 'assistant') &&
          message.content.length > 0,
      );

    if (!next.length) {
      return current;
    }

    const currentIsPrefix =
      next.length >= current.length &&
      current.every(
        (message, index) =>
          next[index]?.role === message.role &&
          next[index]?.content === message.content,
      );

    if (currentIsPrefix) {
      return next;
    }

    return next.reduce<ChatMessage[]>((merged, message) => {
      const previous = merged.at(-1);

      if (previous?.role === message.role && previous.content === message.content) {
        return merged;
      }

      return [...merged, message];
    }, current);
  }

  private toAcademicLevel(raw: string): ProfileDraft['academicLevel'] {
    if (!raw) return null;
    if (raw.includes('high')) return 'high_school';
    if (raw.includes('undergraduate') || raw.includes('bachelor') || raw.includes('license')) return 'undergraduate';
    if (raw.includes('graduate') || raw.includes('master') || raw.includes('phd')) return 'graduate';
    if (raw.includes('bootcamp') || raw.includes('certificate')) return 'bootcamp_certificate';
    if (raw.includes('self')) return 'self_taught';
    return null;
  }

  private toPreferredLocation(raw: string): ProfileDraft['preferredLocation'] {
    if (!raw) return null;
    if (raw.includes('remote')) return 'remote';
    if (raw.includes('international') || raw.includes('abroad') || raw.includes('global')) return 'international';
    return 'local';
  }

  private sanitizeNormalizedProfile(value: unknown): NormalizedProfile | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    return {
      passions: this.ensureStringArray(data.passions),
      interests: this.ensureStringArray(data.interests),
      causes: this.ensureStringArray(data.causes),
      strengths: this.ensureStringArray(data.strengths),
      academicLevel:
        typeof data.academicLevel === 'string'
          ? data.academicLevel
          : 'undergraduate',
      fieldOfStudy:
        typeof data.fieldOfStudy === 'string' ? data.fieldOfStudy : '',
      skillLevel:
        typeof data.skillLevel === 'string' ? data.skillLevel : 'beginner',
      personalGoal:
        typeof data.personalGoal === 'string' ? data.personalGoal : '',
      careerClarity:
        typeof data.careerClarity === 'string'
          ? data.careerClarity
          : 'i_dont_know',
      mainChallenge:
        typeof data.mainChallenge === 'string'
          ? data.mainChallenge
          : 'i_dont_know_what_fits_me',
      values: this.ensureStringArray(data.values) as WorkValue[],
      opportunityTypes: this.ensureStringArray(
        data.opportunityTypes,
      ) as AnalyzeProfilePayload['opportunityTypes'],
      preferredLocation:
        typeof data.preferredLocation === 'string'
          ? data.preferredLocation
          : 'remote',
      themes: this.ensureStringArray(data.themes),
      readiness:
        typeof data.readiness === 'number' && Number.isFinite(data.readiness)
          ? data.readiness
          : 0,
    } as NormalizedProfile;
  }

  private sanitizeDiagnosis(value: unknown): Diagnosis | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    return {
      recommendationMode:
        typeof data.recommendationMode === 'string'
          ? data.recommendationMode
          : 'explore',
      mainNeed: typeof data.mainNeed === 'string' ? data.mainNeed : '',
      summary: typeof data.summary === 'string' ? data.summary : '',
      suggestedNextStep:
        typeof data.suggestedNextStep === 'string'
          ? data.suggestedNextStep
          : '',
    } as Diagnosis;
  }

  private sanitizeRecommendations(value: unknown): CareerRecommendations | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (!this.isRecord(data.profileSummary)) {
      return null;
    }

    const summary: any = data.profileSummary;

    const topChoices = Array.isArray(data.topChoices)
      ? data.topChoices
          .map((choice: unknown) => this.sanitizeCareerChoice(choice))
          .filter(
            (choice: CareerChoice | null): choice is CareerChoice =>
              choice !== null,
          )
      : [];

    if (!topChoices.length) {
      return null;
    }

    return {
      profileSummary: {
        themes: this.ensureStringArray(summary.themes),
        readiness:
          typeof summary.readiness === 'number' &&
          Number.isFinite(summary.readiness)
            ? summary.readiness
            : 0,
        careerClarity:
          typeof summary.careerClarity === 'string'
            ? summary.careerClarity
            : '',
      },
      topChoices,
    };
  }

  private sanitizeCareerChoice(value: unknown): CareerChoice | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (typeof data.id !== 'string' || typeof data.title !== 'string') {
      return null;
    }

    return {
      label:
        typeof data.label === 'string' ? data.label : 'alternative',
      id: data.id,
      title: data.title,
      score:
        typeof data.score === 'number' && Number.isFinite(data.score)
          ? data.score
          : 0,
      entryDifficulty:
        typeof data.entryDifficulty === 'string'
          ? data.entryDifficulty
          : 'medium',
      shortDescription:
        typeof data.shortDescription === 'string' ? data.shortDescription : '',
      reasons: this.ensureStringArray(data.reasons),
      recommendedOpportunities: this.ensureStringArray(
        data.recommendedOpportunities,
      ),
    } as CareerChoice;
  }

  private sanitizePlan(value: unknown): PlanResult | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (!this.isRecord(data.selectedPath) || !this.isRecord(data.roadmap)) {
      return null;
    }

    if (typeof data.selectedPath.id !== 'string' || typeof data.selectedPath.title !== 'string') {
      return null;
    }

    return {
      selectedPath: {
        id: data.selectedPath.id,
        title: data.selectedPath.title,
        shortDescription:
          typeof data.selectedPath.shortDescription === 'string'
            ? data.selectedPath.shortDescription
            : '',
      },
      roadmap: {
        first30Days: this.ensureStringArray(data.roadmap.first30Days),
        next60Days: this.ensureStringArray(data.roadmap.next60Days),
        next90Days: this.ensureStringArray(data.roadmap.next90Days),
      },
      recommendedOpportunities: Array.isArray(data.recommendedOpportunities)
        ? data.recommendedOpportunities
            .map((item: unknown) => this.sanitizeOpportunity(item))
            .filter(
              (item: OpportunityItem | null): item is OpportunityItem =>
                item !== null,
            )
        : [],
      studyOptions: Array.isArray(data.studyOptions)
        ? data.studyOptions
            .map((item: unknown) => this.sanitizeStudyOption(item))
            .filter(
              (item: StudyOption | null): item is StudyOption =>
                item !== null,
            )
        : [],
      explanation:
        typeof data.explanation === 'string' ? data.explanation : '',
    };
  }

  private sanitizeStudyOption(value: unknown): StudyOption | null {
    if (!this.isRecord(value)) {
      return null;
    }

    return {
      program: typeof value['program'] === 'string' ? value['program'] : '',
      school: typeof value['school'] === 'string' ? value['school'] : '',
      city: typeof value['city'] === 'string' ? value['city'] : '',
      link: typeof value['link'] === 'string' ? value['link'] : '',
    };
  }

  private sanitizeOpportunity(value: unknown): OpportunityItem | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const data: any = value;

    if (typeof data.id !== 'number') {
      return null;
    }

    return {
      id: data.id,
      title: typeof data.title === 'string' ? data.title : '',
      type: typeof data.type === 'string' ? data.type : '',
      location: typeof data.location === 'string' ? data.location : '',
      tags: this.ensureStringArray(data.tags),
      description:
        typeof data.description === 'string' ? data.description : '',
    };
  }

  private saveResultState(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const resultState = this.getPersistedResultState();

    if (
      !resultState.analyzedProfile &&
      !resultState.diagnosis &&
      !resultState.recommendations &&
      !resultState.selectedCareerId &&
      !resultState.plan
    ) {
      this.clearResultStorage();
      return;
    }

    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(resultState));
  }

  private getPersistedResultState(): PersistedResultState {
    const state = this.state();

    return {
      analyzedProfile: state.analyzedProfile,
      diagnosis: state.diagnosis,
      recommendations: state.recommendations,
      selectedCareerId: state.selectedCareerId,
      plan: state.plan,
    };
  }

  private clearDraftStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.draft');
  }

  private clearResultStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(RESULT_STORAGE_KEY);
    localStorage.removeItem(['p', 'a', 't', 'h', 'a', 'i'].join('') + '.profile-flow.result');
  }

  private areDraftValuesEqual<T>(current: T, next: T): boolean {
    if (Array.isArray(current) && Array.isArray(next)) {
      return (
        current.length === next.length &&
        current.every((value, index) => value === next[index])
      );
    }

    return current === next;
  }

  private getSubmissionErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage =
        typeof error.error?.error === 'string' ? error.error.error : null;

      if (backendMessage) {
        if (backendMessage === 'Profile analysis failed') {
          return 'We couldn’t understand your profile just yet. Please try again.';
        }

        if (backendMessage === 'Career recommendation failed') {
          return 'We analyzed your profile, but your recommendations are not ready yet. Please try again.';
        }
      }
    }

    return 'We couldn’t complete this step right now. Please try again.';
  }

  private getPlanErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.error === 'string') {
        return 'We couldn’t build this action plan right now. Please try again.';
      }
    }

    return 'We couldn’t build this action plan right now. Please try again.';
  }
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
