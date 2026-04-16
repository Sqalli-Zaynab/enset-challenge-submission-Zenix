import { Component, OnInit, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';
import { ChatMessage } from '../profile-flow.types';
import { AfaqLogoComponent } from '../shared/ui/afaq-logo/afaq-logo.component';

interface InterviewDisplayMessage extends ChatMessage {
  tone?: 'question' | 'thinking';
}

@Component({
  selector: 'app-input-page',
  standalone: true,
  imports: [NgClass, NgFor, NgIf, RouterLink, AfaqLogoComponent],
  templateUrl: './input-page.component.html',
  styleUrls: ['./input-page.component.css'],
})
export class InputPageComponent implements OnInit {
  @ViewChild('thread') private thread?: ElementRef<HTMLElement>;

  private readonly flow = inject(ProfileFlowService);
  private readonly router = inject(Router);
  private readonly progressStepCount = 4;

  readonly answer = signal('');
  readonly localError = signal<string | null>(null);

  readonly isBusy = computed(
    () => this.flow.isChatLoading() || this.flow.isSubmitting(),
  );

  readonly visibleMessages = computed<InterviewDisplayMessage[]>(() => {
    const currentQuestion = this.flow.currentQuestion().trim();
    const messages = this.flow
      .chatMessages()
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0)
      .map((message, index, allMessages): InterviewDisplayMessage => ({
        ...message,
        tone:
          message.role === 'assistant' &&
          message.content === currentQuestion &&
          index === allMessages.length - 1
            ? 'question'
            : undefined,
      }));

    const lastMessage = messages.at(-1);

    if (
      currentQuestion &&
      !(lastMessage?.role === 'assistant' && lastMessage.content === currentQuestion)
    ) {
      messages.push({
        role: 'assistant',
        content: currentQuestion,
        tone: 'question',
      });
    }

    if (!messages.length && this.flow.isChatLoading()) {
      messages.push({
        role: 'assistant',
        content: 'Preparing your first question...',
        tone: 'thinking',
      });
    }

    if (this.flow.isSubmitting()) {
      messages.push({
        role: 'assistant',
        content: 'Turning your answers into a profile and career recommendations...',
        tone: 'thinking',
      });
    }

    return messages;
  });

  readonly isInitialState = computed(
    () => !this.visibleMessages().some((message) => message.role === 'user'),
  );

  readonly answeredCount = computed(
    () => this.flow.chatMessages().filter((message) => message.role === 'user').length,
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

    if (this.flow.isChatLoading()) {
      return 'Afaq is thinking';
    }

    return `Interview step ${Math.min(this.answeredCount() + 1, this.progressStepCount)} of ${this.progressStepCount}`;
  });

  readonly displayedError = computed(
    () => this.localError() ?? this.flow.chatError() ?? this.flow.submitError(),
  );

  ngOnInit(): void {
    void this.ensureInterviewStarted();
  }

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

    try {
      const status = await this.flow.continueDynamicInterview(text);
      this.answer.set('');
      this.scrollThreadToBottom();

      if (status === 'plan_ready') {
        await this.finishProfileFlow();
      }
    } catch {
      // User-facing feedback is owned by ProfileFlowService.
    } finally {
      this.scrollThreadToBottom();
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private async ensureInterviewStarted(): Promise<void> {
    if (
      this.flow.currentQuestion().trim() ||
      this.flow.chatMessages().length ||
      this.flow.isChatLoading()
    ) {
      return;
    }

    try {
      await this.flow.startDynamicInterview();
      this.scrollThreadToBottom();
    } catch {
      // User-facing feedback is owned by ProfileFlowService.
    }
  }

  private async finishProfileFlow(): Promise<void> {
    this.flow.applyDynamicInfoToDraft();
    await this.flow.analyzeAndRecommend();

    if (this.flow.recommendations()?.topChoices.length) {
      await this.router.navigate(['/results']);
    }
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