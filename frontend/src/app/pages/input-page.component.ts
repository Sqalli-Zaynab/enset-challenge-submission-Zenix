import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';
import {
  AcademicLevel,
  CareerChoice,
  CareerClarity,
  ChatMessage,
  MainChallenge,
  OpportunityItem,
  OpportunityType,
  PlanResult,
  PreferredLocation,
  SkillLevel,
  StudyOption,
  WorkValue,
} from '../profile-flow.types';
import { AfaqLogoComponent } from '../shared/ui/afaq-logo/afaq-logo.component';
import { ResultPdfExportService } from '../shared/services/result-pdf-export.service';
import {
  buildTraitTags,
  getProfileTitle,
  getReadinessLabel,
  getSkillLevelLabel,
} from './result-page.helpers';

interface InterviewDisplayMessage extends ChatMessage {
  tone?: 'question' | 'thinking' | 'result';
}

interface FixedInterviewQuestion {
  key:
    | 'interests'
    | 'workAttraction'
    | 'strengths'
    | 'academicContext'
    | 'careerValues'
    | 'mainGoal'
    | 'workOrientation'
    | 'opportunities';
  prompt: string;
}

type TimelineItem =
  | {
      id: string;
      type: 'message';
      message: InterviewDisplayMessage;
    }
  | {
      id: string;
      type: 'careers';
      groupId: string;
      choices: CareerChoice[];
    }
  | {
      id: string;
      type: 'schools';
      options: StudyOption[];
    }
  | {
      id: string;
      type: 'roadmap';
      plan: PlanResult;
    }
  | {
      id: string;
      type: 'opportunities';
      opportunities: OpportunityItem[];
    }
  | {
      id: string;
      type: 'actions';
      groupId: string;
      actions: WorkflowAction[];
    };

type WorkflowActionType =
  | 'regenerate-careers'
  | 'continue-roadmap'
  | 'regenerate-schools'
  | 'choose-another-career'
  | 'continue-opportunities'
  | 'regenerate-roadmap'
  | 'export-pdf'
  | 'regenerate-opportunities';

interface WorkflowAction {
  id: WorkflowActionType;
  label: string;
  tone?: 'primary' | 'secondary';
}

const INTERVIEW_QUESTIONS: FixedInterviewQuestion[] = [
  {
    key: 'interests',
    prompt: 'What subjects or activities do you enjoy most?',
  },
  {
    key: 'workAttraction',
    prompt: 'What kind of work attracts you most?',
  },
  {
    key: 'strengths',
    prompt: 'What are you naturally good at?',
  },
  {
    key: 'academicContext',
    prompt: 'What are you studying now, and what academic level are you in?',
  },
  {
    key: 'careerValues',
    prompt: 'What matters most to you in a career?',
  },
  {
    key: 'mainGoal',
    prompt: 'What is your main goal right now?',
  },
  {
    key: 'workOrientation',
    prompt: 'Do you prefer analytical, practical, creative, or people-oriented work?',
  },
  {
    key: 'opportunities',
    prompt: 'What type of opportunities interest you most?',
  },
];

@Component({
  selector: 'app-input-page',
  standalone: true,
  imports: [NgClass, NgFor, NgIf, RouterLink, AfaqLogoComponent],
  templateUrl: './input-page.component.html',
  styleUrls: ['./input-page.component.css'],
})
export class InputPageComponent {
  @ViewChild('thread') private thread?: ElementRef<HTMLElement>;

  private readonly flow = inject(ProfileFlowService);
  private readonly exportService = inject(ResultPdfExportService);
  private readonly answers = new Map<FixedInterviewQuestion['key'], string>();
  private readonly progressStepCount = INTERVIEW_QUESTIONS.length;
  private timelineCounter = 1;
  private actionGroupCounter = 0;
  private careerGroupCounter = 0;
  private hasAppliedInterviewToDraft = false;

  readonly answer = signal('');
  readonly localError = signal<string | null>(null);
  readonly questionIndex = signal(0);
  readonly workflowBusy = signal(false);
  readonly activeActionGroupId = signal<string | null>(null);
  readonly activeCareerGroupId = signal<string | null>('career-initial');
  readonly timeline = signal<TimelineItem[]>([
    {
      id: 'message-1',
      type: 'message',
      message: {
        role: 'assistant',
        content: INTERVIEW_QUESTIONS[0].prompt,
        tone: 'question',
      },
    },
  ]);

  readonly isBusy = computed(
    () =>
      this.workflowBusy() ||
      this.flow.isSubmitting() ||
      this.flow.isGeneratingPlan(),
  );

  readonly interviewComplete = computed(
    () => this.answeredCount() >= this.progressStepCount,
  );

  readonly isInitialState = computed(
    () =>
      !this.timeline().some(
        (item) => item.type === 'message' && item.message.role === 'user',
      ),
  );

  readonly answeredCount = computed(
    () =>
      this.timeline().filter(
        (item) => item.type === 'message' && item.message.role === 'user',
      ).length,
  );

  readonly progressSteps = computed(() => {
    const answeredCount = Math.min(this.answeredCount(), this.progressStepCount);
    const activeIndex = Math.min(answeredCount, this.progressStepCount - 1);

    return Array.from({ length: this.progressStepCount }, (_, index) => ({
      isActive:
        !this.isBusy() &&
        answeredCount < this.progressStepCount &&
        index === activeIndex,
      isDone: answeredCount >= this.progressStepCount || index < answeredCount,
    }));
  });

  readonly progressText = computed(() => {
    if (this.flow.isSubmitting()) {
      return 'Analyzing profile';
    }

    if (this.flow.isGeneratingPlan()) {
      return 'Building roadmap';
    }

    if (this.interviewComplete()) {
      return 'Human checkpoint';
    }

    return `Interview step ${Math.min(this.answeredCount() + 1, this.progressStepCount)} of ${this.progressStepCount}`;
  });

  readonly composerPlaceholder = computed(() =>
    this.interviewComplete()
      ? 'Use the choices in the conversation to continue...'
      : 'Reply naturally...',
  );

  readonly displayedError = computed(
    () => this.localError() ?? this.flow.submitError() ?? this.flow.planError(),
  );

  readonly agentTrace = computed(() =>
    [
      ...this.flow.analysisTrace(),
      ...this.flow.recommendationTrace(),
    ].slice(-4),
  );

  async sendAnswer(): Promise<void> {
    const text = this.answer().trim();

    if (this.isBusy() || this.interviewComplete()) {
      return;
    }

    if (!text) {
      this.localError.set('Write a short answer to continue.');
      return;
    }

    this.localError.set(null);
    this.flow.clearSubmitFeedback();
    this.flow.clearPlanFeedback();
    this.answer.set('');

    const currentQuestion = INTERVIEW_QUESTIONS[this.questionIndex()];
    this.answers.set(currentQuestion.key, text);
    this.addUserMessage(text);

    const nextIndex = this.questionIndex() + 1;

    if (nextIndex < INTERVIEW_QUESTIONS.length) {
      this.questionIndex.set(nextIndex);
      this.addAssistantMessage(INTERVIEW_QUESTIONS[nextIndex].prompt, 'question');
      return;
    }

    this.questionIndex.set(INTERVIEW_QUESTIONS.length - 1);
    await this.finishInterviewAndRecommend();
  }

  handleComposerInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.answer.set(textarea.value);
    this.localError.set(null);

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 170)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 170 ? 'auto' : 'hidden';
  }

  handleComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      void this.sendAnswer();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      void this.sendAnswer();
    }
  }

  async selectCareer(choice: CareerChoice): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    this.activeCareerGroupId.set(null);
    this.activeActionGroupId.set(null);
    this.localError.set(null);
    this.flow.clearPlanFeedback();
    this.addUserMessage(`I choose ${choice.title}.`);
    this.addAssistantMessage(
      'I am looking for schools and programs that can build a strong foundation for this path...',
      'thinking',
    );

    await this.generatePlanForChoice(choice.id);

    const plan = this.flow.plan();

    if (!plan) {
      this.localError.set('I could not prepare the next step right now. Please try again.');
      return;
    }

    this.addAssistantMessage(
      'Here are relevant schools and programs for the selected path.',
      'result',
    );
    this.addSchoolsBlock(plan.studyOptions ?? []);
    this.addActions([
      {
        id: 'continue-roadmap',
        label: 'Continue to roadmap',
        tone: 'primary',
      },
      {
        id: 'regenerate-schools',
        label: 'Regenerate schools',
      },
      {
        id: 'choose-another-career',
        label: 'Choose another career',
      },
    ]);
  }

  handleAction(action: WorkflowActionType): void {
    if (this.isBusy()) {
      return;
    }

    this.activeActionGroupId.set(null);

    switch (action) {
      case 'regenerate-careers':
        void this.regenerateCareers();
        break;
      case 'continue-roadmap':
        void this.continueToRoadmap();
        break;
      case 'regenerate-schools':
        void this.regenerateSchools();
        break;
      case 'choose-another-career':
        this.showCareerChoicesAgain();
        break;
      case 'continue-opportunities':
        void this.continueToOpportunities();
        break;
      case 'regenerate-roadmap':
        void this.regenerateRoadmap();
        break;
      case 'regenerate-opportunities':
        void this.regenerateOpportunities();
        break;
      case 'export-pdf':
        this.exportPlan();
        break;
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByTimelineItem(_: number, item: TimelineItem): string {
    return item.id;
  }

  trackByChoice(_: number, choice: CareerChoice): string {
    return choice.id;
  }

  trackByStudyOption(_: number, option: StudyOption): string {
    return `${option.school}-${option.program}`;
  }

  trackByOpportunity(_: number, opportunity: OpportunityItem): number {
    return opportunity.id;
  }

  trackByAction(_: number, action: WorkflowAction): string {
    return action.id;
  }

  private async finishInterviewAndRecommend(): Promise<void> {
    if (!this.hasAppliedInterviewToDraft) {
      this.applyFixedInterviewToDraft();
      this.flow.saveDraft();
      this.hasAppliedInterviewToDraft = true;
    }

    await this.runCareerRecommendationStage(false);
  }

  private async regenerateCareers(): Promise<void> {
    this.addUserMessage('Regenerate recommendations.');
    await this.runCareerRecommendationStage(true);
  }

  private async runCareerRecommendationStage(isRegeneration: boolean): Promise<void> {
    this.workflowBusy.set(true);
    this.localError.set(null);
    this.flow.clearSubmitFeedback();
    this.flow.clearPlanFeedback();
    this.activeCareerGroupId.set(null);

    this.addAssistantMessage(
      isRegeneration
        ? 'I am refreshing the career recommendations from your interview answers...'
        : 'I am analyzing your profile and preparing your strongest career matches...',
      'thinking',
    );

    await this.flow.analyzeAndRecommend();

    const choices = this.flow.recommendations()?.topChoices.slice(0, 3) ?? [];

    if (!choices.length) {
      this.workflowBusy.set(false);
      this.localError.set(
        'I could not build career recommendations right now. Please try again.',
      );
      return;
    }

    this.addAssistantMessage(
      'I found three strong directions. Choose one path and I will develop the study path, roadmap, and opportunities.',
      'result',
    );
    this.addCareerBlock(choices);
    this.addActions([
      {
        id: 'regenerate-careers',
        label: 'Regenerate recommendations',
      },
    ]);
    this.workflowBusy.set(false);
  }

  private async generatePlanForChoice(choiceId: string): Promise<void> {
    this.workflowBusy.set(true);
    await this.flow.generatePlan(choiceId);
    this.workflowBusy.set(false);
  }

  private async regenerateSchools(): Promise<void> {
    const selectedChoice = this.getSelectedChoice();

    if (!selectedChoice) {
      this.showCareerChoicesAgain();
      return;
    }

    this.addUserMessage('Regenerate schools and programs.');
    this.addAssistantMessage('I am checking the study path again...', 'thinking');
    await this.generatePlanForChoice(selectedChoice.id);

    const plan = this.flow.plan();

    if (!plan) {
      this.localError.set('I could not refresh the study path right now.');
      return;
    }

    this.addSchoolsBlock(plan.studyOptions ?? []);
    this.addActions([
      {
        id: 'continue-roadmap',
        label: 'Continue to roadmap',
        tone: 'primary',
      },
      {
        id: 'regenerate-schools',
        label: 'Regenerate schools',
      },
      {
        id: 'choose-another-career',
        label: 'Choose another career',
      },
    ]);
  }

  private async continueToRoadmap(): Promise<void> {
    const plan = await this.ensureCurrentPlan();

    if (!plan) {
      this.localError.set('I could not build the roadmap right now.');
      return;
    }

    this.addUserMessage('Continue to roadmap.');
    this.addAssistantMessage('I am building your competency roadmap...', 'thinking');
    this.addRoadmapBlock(plan);
    this.addActions([
      {
        id: 'continue-opportunities',
        label: 'Continue to opportunities',
        tone: 'primary',
      },
      {
        id: 'regenerate-roadmap',
        label: 'Regenerate roadmap',
      },
      {
        id: 'regenerate-schools',
        label: 'Back to schools',
      },
    ]);
  }

  private async regenerateRoadmap(): Promise<void> {
    const selectedChoice = this.getSelectedChoice();

    if (!selectedChoice) {
      this.showCareerChoicesAgain();
      return;
    }

    this.addUserMessage('Regenerate roadmap.');
    this.addAssistantMessage('I am rebuilding your roadmap...', 'thinking');
    await this.generatePlanForChoice(selectedChoice.id);

    const plan = this.flow.plan();

    if (!plan) {
      this.localError.set('I could not refresh the roadmap right now.');
      return;
    }

    this.addRoadmapBlock(plan);
    this.addActions([
      {
        id: 'continue-opportunities',
        label: 'Continue to opportunities',
        tone: 'primary',
      },
      {
        id: 'regenerate-roadmap',
        label: 'Regenerate roadmap',
      },
      {
        id: 'regenerate-schools',
        label: 'Back to schools',
      },
    ]);
  }

  private async continueToOpportunities(): Promise<void> {
    const plan = await this.ensureCurrentPlan();

    if (!plan) {
      this.localError.set('I could not match opportunities right now.');
      return;
    }

    this.addUserMessage('Continue to opportunities.');
    this.addAssistantMessage('I am matching opportunities for your path...', 'thinking');
    this.addOpportunitiesBlock(plan.recommendedOpportunities);
    this.addActions([
      {
        id: 'export-pdf',
        label: 'Generate PDF',
        tone: 'primary',
      },
      {
        id: 'regenerate-opportunities',
        label: 'Regenerate opportunities',
      },
      {
        id: 'choose-another-career',
        label: 'Choose another career',
      },
    ]);
  }

  private async regenerateOpportunities(): Promise<void> {
    const selectedChoice = this.getSelectedChoice();

    if (!selectedChoice) {
      this.showCareerChoicesAgain();
      return;
    }

    this.addUserMessage('Regenerate opportunities.');
    this.addAssistantMessage('I am checking the opportunity matches again...', 'thinking');
    await this.generatePlanForChoice(selectedChoice.id);

    const plan = this.flow.plan();

    if (!plan) {
      this.localError.set('I could not refresh opportunities right now.');
      return;
    }

    this.addOpportunitiesBlock(plan.recommendedOpportunities);
    this.addActions([
      {
        id: 'export-pdf',
        label: 'Generate PDF',
        tone: 'primary',
      },
      {
        id: 'regenerate-opportunities',
        label: 'Regenerate opportunities',
      },
      {
        id: 'choose-another-career',
        label: 'Choose another career',
      },
    ]);
  }

  private showCareerChoicesAgain(): void {
    const choices = this.flow.recommendations()?.topChoices.slice(0, 3) ?? [];

    if (!choices.length) {
      this.localError.set('Career recommendations are not ready yet.');
      return;
    }

    this.addUserMessage('Choose another career.');
    this.addAssistantMessage('Choose the career path you want me to develop.', 'result');
    this.addCareerBlock(choices);
    this.addActions([
      {
        id: 'regenerate-careers',
        label: 'Regenerate recommendations',
      },
    ]);
  }

  private async ensureCurrentPlan(): Promise<PlanResult | null> {
    const selectedChoice = this.getSelectedChoice();
    const existingPlan = this.flow.plan();

    if (existingPlan && selectedChoice?.id === existingPlan.selectedPath.id) {
      return existingPlan;
    }

    if (!selectedChoice) {
      return null;
    }

    await this.generatePlanForChoice(selectedChoice.id);

    return this.flow.plan();
  }

  private addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content });
  }

  private addAssistantMessage(
    content: string,
    tone: InterviewDisplayMessage['tone'] = 'question',
  ): void {
    this.addMessage({ role: 'assistant', content, tone });
  }

  private addMessage(message: InterviewDisplayMessage): void {
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'message',
        message,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private addCareerBlock(choices: CareerChoice[]): void {
    const groupId = this.nextCareerGroupId();
    this.activeCareerGroupId.set(groupId);
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'careers',
        groupId,
        choices,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private addSchoolsBlock(options: StudyOption[]): void {
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'schools',
        options,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private addRoadmapBlock(plan: PlanResult): void {
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'roadmap',
        plan,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private addOpportunitiesBlock(opportunities: OpportunityItem[]): void {
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'opportunities',
        opportunities,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private addActions(actions: WorkflowAction[]): void {
    const groupId = this.nextActionGroupId();
    this.activeActionGroupId.set(groupId);
    this.timeline.update((items) => [
      ...items,
      {
        id: this.nextTimelineId(),
        type: 'actions',
        groupId,
        actions,
      },
    ]);
    this.scrollThreadToBottom();
  }

  private nextTimelineId(): string {
    this.timelineCounter += 1;
    return `timeline-${this.timelineCounter}`;
  }

  private nextActionGroupId(): string {
    this.actionGroupCounter += 1;
    return `actions-${this.actionGroupCounter}`;
  }

  private nextCareerGroupId(): string {
    this.careerGroupCounter += 1;
    return `careers-${this.careerGroupCounter}`;
  }

  private exportPlan(): void {
    const selectedChoice = this.getSelectedChoice();
    const plan = this.flow.plan();
    const analyzedProfile = this.flow.analyzedProfile();
    const recommendations = this.flow.recommendations();

    if (!selectedChoice || !plan || !analyzedProfile || !recommendations) {
      this.localError.set('The report is not ready yet.');
      return;
    }

    void this.exportService.exportResultReport({
      analyzedProfile,
      diagnosis: this.flow.diagnosis(),
      recommendations,
      selectedChoice,
      plan,
      profileTitle: getProfileTitle(selectedChoice.id),
      profileSummary: this.getProfileSummary(),
      traitTags: buildTraitTags(analyzedProfile, recommendations.profileSummary),
      skillLevelLabel: getSkillLevelLabel(analyzedProfile),
      readinessLabel: getReadinessLabel(analyzedProfile),
    });
  }

  private getProfileSummary(): string {
    const profile = this.flow.analyzedProfile();

    if (profile?.personalGoal.trim()) {
      return `"${profile.personalGoal.trim()}"`;
    }

    return this.flow.diagnosis()?.summary ?? 'Your profile is ready for the next step.';
  }

  private getSelectedChoice(): CareerChoice | null {
    const selectedCareerId = this.flow.selectedCareerId();

    if (!selectedCareerId) {
      return null;
    }

    return (
      this.flow
        .recommendations()
        ?.topChoices.find((choice) => choice.id === selectedCareerId) ?? null
    );
  }

  private applyFixedInterviewToDraft(): void {
    const interests = this.parseList(this.answers.get('interests'));
    const strengths = this.parseList(this.answers.get('strengths'));
    const combinedText = Array.from(this.answers.values()).join(' ');
    const field = this.inferFieldOfStudy(combinedText);

    this.flow.updateDraftField('passions', interests.length ? interests : [field]);
    this.flow.updateDraftField('interests', interests.length ? interests : [field]);
    this.flow.updateDraftField('causes', this.inferCauses(combinedText));
    this.flow.updateDraftField(
      'strengths',
      this.mergeUnique([
        ...strengths,
        ...this.inferOrientationStrengths(this.answers.get('workOrientation')),
      ]),
    );
    this.flow.updateDraftField(
      'academicLevel',
      this.inferAcademicLevel(this.answers.get('academicContext')),
    );
    this.flow.updateDraftField('fieldOfStudy', field);
    this.flow.updateDraftField('skillLevel', this.inferSkillLevel(combinedText));
    this.flow.updateDraftField(
      'personalGoal',
      this.answers.get('mainGoal')?.trim() ||
        this.answers.get('workAttraction')?.trim() ||
        'Find a direction that fits my strengths and future goals.',
    );
    this.flow.updateDraftField('careerClarity', this.inferCareerClarity(combinedText));
    this.flow.updateDraftField('mainChallenge', this.inferMainChallenge(combinedText));
    this.flow.updateDraftField('values', this.inferValues(combinedText));
    this.flow.updateDraftField(
      'opportunityTypes',
      this.inferOpportunityTypes(this.answers.get('opportunities')),
    );
    this.flow.updateDraftField('preferredLocation', this.inferPreferredLocation(combinedText));
  }

  private parseList(value: string | undefined): string[] {
    return (value ?? '')
      .split(/\n|,|;|\s+and\s+|\s*&\s+/gi)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 1);
  }

  private mergeUnique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)));
  }

  private inferFieldOfStudy(text: string): string {
    const value = text.toLowerCase();

    if (this.hasAny(value, ['cyber', 'security', 'network'])) return 'cybersecurity';
    if (this.hasAny(value, ['ai', 'data', 'machine learning', 'python', 'statistics'])) return 'data and ai';
    if (this.hasAny(value, ['design', 'ux', 'ui', 'figma', 'creative'])) return 'design';
    if (this.hasAny(value, ['marketing', 'content', 'brand', 'social media'])) return 'marketing';
    if (this.hasAny(value, ['business', 'startup', 'management', 'product'])) return 'business and product';
    if (this.hasAny(value, ['code', 'coding', 'software', 'app', 'web', 'computer science', 'programming'])) {
      return 'software engineering';
    }

    return 'general exploration';
  }

  private inferAcademicLevel(value: string | undefined): AcademicLevel {
    const text = (value ?? '').toLowerCase();

    if (this.hasAny(text, ['master', 'phd', 'graduate'])) return 'graduate';
    if (this.hasAny(text, ['bootcamp', 'certificate'])) return 'bootcamp_certificate';
    if (this.hasAny(text, ['self taught', 'self-taught', 'self'])) return 'self_taught';
    if (this.hasAny(text, ['bac', 'baccalaureate', 'high school', 'lycee'])) return 'high_school';

    return 'undergraduate';
  }

  private inferSkillLevel(text: string): SkillLevel {
    const value = text.toLowerCase();

    if (this.hasAny(value, ['advanced', 'expert', 'strong', 'very good'])) return 'advanced';
    if (this.hasAny(value, ['intermediate', 'some experience', 'okay', 'good'])) return 'intermediate';

    return 'beginner';
  }

  private inferCareerClarity(text: string): CareerClarity {
    const value = text.toLowerCase();

    if (this.hasAny(value, ['i know', 'clear', 'decided', 'become'])) return 'i_know';
    if (this.hasAny(value, ['some idea', 'ideas', 'maybe', 'between'])) return 'some_ideas';

    return 'i_dont_know';
  }

  private inferMainChallenge(text: string): MainChallenge {
    const value = text.toLowerCase();

    if (this.hasAny(value, ['opportunity', 'internship', 'hackathon', 'experience'])) {
      return 'i_cant_find_opportunities';
    }

    if (this.hasAny(value, ['how', 'roadmap', 'plan', 'steps', 'reach'])) {
      return 'i_dont_know_how_to_reach_my_goal';
    }

    return 'i_dont_know_what_fits_me';
  }

  private inferPreferredLocation(text: string): PreferredLocation {
    const value = text.toLowerCase();

    if (this.hasAny(value, ['international', 'abroad', 'global', 'outside morocco'])) return 'international';
    if (this.hasAny(value, ['remote', 'online', 'from home'])) return 'remote';

    return 'local';
  }

  private inferValues(text: string): WorkValue[] {
    const value = text.toLowerCase();
    const values: WorkValue[] = [];

    if (this.hasAny(value, ['impact', 'help', 'useful', 'people', 'society'])) values.push('impact');
    if (this.hasAny(value, ['growth', 'learn', 'progress', 'improve'])) values.push('growth');
    if (this.hasAny(value, ['stable', 'stability', 'secure', 'income', 'salary'])) values.push('stability');
    if (this.hasAny(value, ['creative', 'design', 'create', 'content'])) values.push('creativity');
    if (this.hasAny(value, ['freedom', 'remote', 'flexible', 'independent'])) values.push('freedom');
    if (this.hasAny(value, ['challenge', 'hard', 'ambitious', 'competitive'])) values.push('challenge');
    if (this.hasAny(value, ['innovation', 'ai', 'startup', 'new ideas'])) values.push('innovation');

    return values.length ? this.uniqueTyped(values) : ['growth', 'stability'];
  }

  private inferCauses(text: string): string[] {
    const value = text.toLowerCase();
    const causes: string[] = [];

    if (this.hasAny(value, ['education', 'student', 'learn'])) causes.push('education');
    if (this.hasAny(value, ['health', 'medical'])) causes.push('health');
    if (this.hasAny(value, ['environment', 'green'])) causes.push('environment');
    if (this.hasAny(value, ['community', 'people', 'society'])) causes.push('community');
    if (this.hasAny(value, ['accessibility', 'inclusion'])) causes.push('accessibility');

    return this.mergeUnique(causes);
  }

  private inferOrientationStrengths(value: string | undefined): string[] {
    const text = (value ?? '').toLowerCase();
    const strengths: string[] = [];

    if (this.hasAny(text, ['analytical', 'analysis', 'logic'])) strengths.push('analysis', 'logic');
    if (this.hasAny(text, ['practical', 'build', 'hands-on'])) strengths.push('problem solving');
    if (this.hasAny(text, ['creative', 'design', 'create'])) strengths.push('creativity');
    if (this.hasAny(text, ['people', 'team', 'communication'])) strengths.push('communication', 'teamwork');

    return strengths.length ? strengths : ['curiosity'];
  }

  private inferOpportunityTypes(value: string | undefined): OpportunityType[] {
    const text = (value ?? '').toLowerCase();
    const types: OpportunityType[] = [];

    if (this.hasAny(text, ['hackathon', 'competition'])) types.push('hackathons');
    if (this.hasAny(text, ['internship', 'stage', 'job'])) types.push('internships');
    if (this.hasAny(text, ['bootcamp', 'course', 'training'])) types.push('bootcamps');
    if (this.hasAny(text, ['project', 'portfolio', 'open source'])) types.push('projects');

    return types.length ? this.uniqueTyped(types) : ['projects', 'internships'];
  }

  private uniqueTyped<T extends string>(values: T[]): T[] {
    return Array.from(new Set(values));
  }

  private hasAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private scrollThreadToBottom(): void {
    window.setTimeout(() => {
      const thread = this.thread?.nativeElement;

      if (thread) {
        thread.scrollTop = thread.scrollHeight;
      }
    });
  }
}
