import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';

import { ProfileFlowService } from '../profile-flow.service';

@Component({
  selector: 'app-input-page',
  standalone: true,
  imports: [NgIf],
  templateUrl: './input-page.component.html',
  styleUrls: ['./input-page.component.css'],
})
export class InputPageComponent implements OnInit {
  readonly flow = inject(ProfileFlowService);
  private readonly router = inject(Router);

  readonly answer = signal('');
  readonly question = this.flow.currentQuestion;
  readonly chatError = this.flow.chatError;
  readonly submitError = this.flow.submitError;
  readonly isBusy = computed(
    () => this.flow.isChatLoading() || this.flow.isSubmitting(),
  );

  ngOnInit(): void {
    void this.startInterview();
  }

  async startInterview(): Promise<void> {
    this.answer.set('');
    this.flow.clearSubmitFeedback();

    try {
      await this.flow.startDynamicInterview();
    } catch {
      // Error message is already set in the service.
    }
  }

  async nextQuestion(): Promise<void> {
    const text = this.answer().trim();

    if (!text || this.isBusy()) {
      return;
    }

    this.flow.clearSubmitFeedback();

    try {
      const status = await this.flow.continueDynamicInterview(text);
      this.answer.set('');

      if (status === 'plan_ready') {
        await this.finishProfileFlow();
      }
    } catch {
      // Error message is already set in the service.
    }
  }

  private async finishProfileFlow(): Promise<void> {
    this.flow.applyDynamicInfoToDraft();
    await this.flow.analyzeAndRecommend();

    if (!this.submitError() && this.flow.recommendations()?.topChoices.length) {
      await this.router.navigate(['/results']);
    }
  }
}
