import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';
import {
  AcademicLevel,
  CareerClarity,
  ChatMessage,
  MainChallenge,
  OpportunityType,
  PreferredLocation,
  SkillLevel,
  WorkValue,
} from '../profile-flow.types';
import { AfaqLogoComponent } from '../shared/ui/afaq-logo/afaq-logo.component';

interface InterviewDisplayMessage extends ChatMessage {
  tone?: 'question' | 'thinking';
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
  private readonly router = inject(Router);
  private readonly answers = new Map<FixedInterviewQuestion['key'], string>();
  private readonly progressStepCount = INTERVIEW_QUESTIONS.length;

  readonly answer = signal('');
  readonly localError = signal<string | null>(null);
  readonly questionIndex = signal(0);
  readonly messages = signal<InterviewDisplayMessage[]>([
    {
      role: 'assistant',
      content: INTERVIEW_QUESTIONS[0].prompt,
      tone: 'question',
    },
  ]);

  readonly isBusy = computed(() => this.flow.isSubmitting());

  readonly visibleMessages = computed<InterviewDisplayMessage[]>(() => {
    const messages = [...this.messages()];

    if (this.flow.isSubmitting()) {
      messages.push({
        role: 'assistant',
        content: 'Analyzing your profile and preparing 3 career recommendations...',
        tone: 'thinking',
      });
    }

    return messages;
  });

  readonly isInitialState = computed(
    () => !this.messages().some((message) => message.role === 'user'),
  );

  readonly answeredCount = computed(
    () => this.messages().filter((message) => message.role === 'user').length,
  );

  readonly progressSteps = computed(() => {
    const activeIndex = Math.min(this.answeredCount(), this.progressStepCount - 1);

    return Array.from({ length: this.progressStepCount }, (_, index) => ({
      isActive: !this.flow.isSubmitting() && index === activeIndex,
      isDone: this.flow.isSubmitting() || index < this.answeredCount(),
    }));
  });

  readonly progressText = computed(() => {
    if (this.flow.isSubmitting()) {
      return 'Building recommendations';
    }

    return `Interview step ${Math.min(this.answeredCount() + 1, this.progressStepCount)} of ${this.progressStepCount}`;
  });

  readonly displayedError = computed(
    () => this.localError() ?? this.flow.submitError(),
  );

  async sendAnswer(): Promise<void> {
    const text = this.answer().trim();

    if (this.isBusy()) {
      return;
    }

    if (!text) {
      this.localError.set('Write a short answer to continue.');
      return;
    }

    this.localError.set(null);
    this.flow.clearSubmitFeedback();
    this.answer.set('');

    const currentQuestion = INTERVIEW_QUESTIONS[this.questionIndex()];
    this.answers.set(currentQuestion.key, text);
    this.messages.update((messages) => [
      ...messages,
      { role: 'user', content: text },
    ]);

    const nextIndex = this.questionIndex() + 1;

    if (nextIndex < INTERVIEW_QUESTIONS.length) {
      this.questionIndex.set(nextIndex);
      this.messages.update((messages) => [
        ...messages,
        {
          role: 'assistant',
          content: INTERVIEW_QUESTIONS[nextIndex].prompt,
          tone: 'question',
        },
      ]);
      this.scrollThreadToBottom();
      return;
    }

    this.questionIndex.set(INTERVIEW_QUESTIONS.length - 1);
    await this.finishProfileFlow();
  }

  trackByIndex(index: number): number {
    return index;
  }

  private async finishProfileFlow(): Promise<void> {
    this.applyFixedInterviewToDraft();
    this.flow.saveDraft();

    await this.flow.analyzeAndRecommend();

    if (this.flow.recommendations()?.topChoices.length) {
      await this.router.navigate(['/results']);
    }
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
