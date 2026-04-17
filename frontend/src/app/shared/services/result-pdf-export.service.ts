import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';

import {
  CareerChoice,
  CareerRecommendations,
  Diagnosis,
  NormalizedProfile,
  OpportunityItem,
  PlanResult,
  StudyOption,
} from '../../profile-flow.types';

interface ResultReportExportPayload {
  analyzedProfile: NormalizedProfile;
  diagnosis: Diagnosis | null;
  recommendations: CareerRecommendations;
  selectedChoice: CareerChoice;
  plan: PlanResult;
  profileTitle: string;
  profileSummary: string;
  traitTags: string[];
  skillLevelLabel: string;
  readinessLabel: string;
}

interface PdfTheme {
  ink: [number, number, number];
  muted: [number, number, number];
  accent: [number, number, number];
  accentSoft: [number, number, number];
  line: [number, number, number];
  page: [number, number, number];
}

interface PdfContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  topY: number;
  bottomY: number;
  width: number;
  cursorY: number;
  dateLabel: string;
}

interface PdfLogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

const THEME: PdfTheme = {
  ink: [31, 33, 41],
  muted: [98, 101, 114],
  accent: [58, 72, 168],
  accentSoft: [236, 239, 255],
  line: [227, 229, 236],
  page: [250, 249, 246],
};

@Injectable({ providedIn: 'root' })
export class ResultPdfExportService {
  private logoAssetPromise: Promise<PdfLogoAsset | null> | null = null;

  async exportResultReport(payload: ResultReportExportPayload): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const { jsPDF: JsPDF } = await import('jspdf');
    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const generatedAt = new Date();
    const ctx: PdfContext = {
      doc,
      pageWidth: doc.internal.pageSize.getWidth(),
      pageHeight: doc.internal.pageSize.getHeight(),
      marginX: 18,
      topY: 22,
      bottomY: 18,
      width: doc.internal.pageSize.getWidth() - 36,
      cursorY: 22,
      dateLabel: this.formatDate(generatedAt),
    };

    doc.setProperties({
      title: `${payload.selectedChoice.title} Career Guidance Report`,
      subject: 'Afaq career guidance report',
      author: 'Afaq',
      creator: 'Afaq',
      keywords: 'career guidance, afaq, roadmap, opportunities',
    });

    const logoAsset = await this.loadPdfLogoAsset();

    this.drawPageBackground(ctx);
    this.drawHeader(ctx, payload, logoAsset);
    this.drawProfileSnapshot(ctx, payload);
    this.drawChosenCareer(ctx, payload);
    this.drawAlternativePaths(ctx, payload);
    this.drawPrograms(ctx, payload.plan.studyOptions ?? []);
    this.drawRoadmap(ctx, payload);
    this.drawOpportunities(ctx, payload.plan.recommendedOpportunities);
    this.drawFooters(ctx.doc);

    const fileSlug = payload.selectedChoice.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    doc.save(`afaq-${fileSlug || 'career-guidance-report'}.pdf`);
  }

  private drawPageBackground(ctx: PdfContext): void {
    ctx.doc.setFillColor(...THEME.page);
    ctx.doc.rect(0, 0, ctx.pageWidth, ctx.pageHeight, 'F');
  }

  private drawHeader(
    ctx: PdfContext,
    payload: ResultReportExportPayload,
    logoAsset: PdfLogoAsset | null,
  ): void {
    const logoX = ctx.marginX;
    const logoY = ctx.cursorY - 1;
    const logoWidth = 42;
    const logoHeight = 11.1;

    if (logoAsset) {
      ctx.doc.addImage(
        logoAsset.dataUrl,
        'PNG',
        logoX,
        logoY,
        logoWidth,
        logoHeight,
        undefined,
        'FAST',
      );
    } else {
      this.drawFallbackLogo(ctx.doc, logoX, logoY);
    }

    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(21);
    ctx.doc.text('Career Guidance Report', ctx.marginX, ctx.cursorY + 18);

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(9.2);
    ctx.doc.setTextColor(...THEME.muted);
    ctx.doc.text(
      'A concise orientation brief based on the guided interview and final path selection.',
      ctx.marginX,
      ctx.cursorY + 25,
    );

    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8.5);
    ctx.doc.text(ctx.dateLabel, ctx.pageWidth - ctx.marginX, ctx.cursorY + 10, {
      align: 'right',
    });

    this.drawInlineLabel(ctx.doc, ctx.marginX, ctx.cursorY + 33, payload.selectedChoice.title);

    ctx.doc.setDrawColor(...THEME.line);
    ctx.doc.setLineWidth(0.35);
    ctx.doc.line(ctx.marginX, ctx.cursorY + 39, ctx.pageWidth - ctx.marginX, ctx.cursorY + 39);
    ctx.cursorY += 48;
  }

  private drawProfileSnapshot(ctx: PdfContext, payload: ResultReportExportPayload): void {
    const profileSentence = this.buildProfileSnapshotText(payload);
    const strongestSignals = this.takeList(payload.analyzedProfile.strengths, 3);

    this.drawSectionTitle(ctx, 'Profile Snapshot');
    this.drawBodyText(ctx, profileSentence);
    this.drawKeyValueRows(ctx, [
      {
        label: 'Profile',
        value: payload.profileTitle,
      },
      {
        label: 'Academic context',
        value: this.describeAcademicContext(payload),
      },
      {
        label: 'Strongest signals',
        value: this.joinNaturalList(strongestSignals, 'motivation and curiosity'),
      },
      {
        label: 'Orientation insight',
        value: this.cleanSentence(
          payload.diagnosis?.suggestedNextStep || 'A practical exploration strategy is recommended.',
        ),
      },
    ]);
  }

  private drawChosenCareer(ctx: PdfContext, payload: ResultReportExportPayload): void {
    this.drawSectionTitle(ctx, 'Chosen Career');

    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(16);
    ctx.doc.text(payload.selectedChoice.title, ctx.marginX, ctx.cursorY);
    ctx.cursorY += 7;

    this.drawBodyText(
      ctx,
      this.cleanSentence(payload.selectedChoice.shortDescription || payload.plan.explanation),
      9.4,
    );
    this.drawLabelAndParagraph(ctx, 'Why this path fits', this.buildCareerFitText(payload));
  }

  private drawAlternativePaths(ctx: PdfContext, payload: ResultReportExportPayload): void {
    const alternatives = payload.recommendations.topChoices
      .filter((choice) => choice.id !== payload.selectedChoice.id)
      .slice(0, 2);

    if (!alternatives.length) {
      return;
    }

    this.drawSectionTitle(ctx, 'Alternative Paths');

    for (const option of alternatives) {
      this.ensureSpace(ctx, 12);
      ctx.doc.setTextColor(...THEME.ink);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(10.5);
      ctx.doc.text(option.title, ctx.marginX, ctx.cursorY);
      ctx.cursorY += 4.5;
      this.drawBodyText(
        ctx,
        this.cleanSentence(option.reasons[0] || option.shortDescription || 'A credible nearby option.'),
        8.7,
      );
    }
  }

  private drawPrograms(ctx: PdfContext, studyOptions: StudyOption[]): void {
    this.drawSectionTitle(ctx, 'Schools And Programs');

    if (!studyOptions.length) {
      this.drawBodyText(ctx, 'No study programs were available for export in this run.');
      return;
    }

    for (const option of studyOptions) {
      this.ensureSpace(ctx, 26);
      this.drawListItemTitle(
        ctx,
        option.program,
        [option.school, option.city, option.degreeLevel].filter(Boolean).join(' | '),
      );
      this.drawBodyText(ctx, this.buildProgramNote(option), 8.7);
      this.drawLinksRow(ctx, [
        { label: 'View program', url: option.programUrl || option.link || '' },
        {
          label: 'School site',
          url:
            option.schoolUrl && option.schoolUrl !== (option.programUrl || option.link)
              ? option.schoolUrl
              : '',
        },
      ]);
      this.drawDivider(ctx);
    }
  }

  private drawRoadmap(ctx: PdfContext, payload: ResultReportExportPayload): void {
    const competencies = this.takeList(
      [
        ...(payload.selectedChoice.coreSkills || []),
        ...(payload.selectedChoice.technicalSkills || []),
      ],
      6,
    );

    this.drawSectionTitle(ctx, 'Competency Roadmap');
    this.drawLabelAndParagraph(
      ctx,
      'Key competencies',
      this.joinNaturalList(competencies, 'practical execution, communication, and consistency'),
    );

    this.drawRoadmapPhase(ctx, 'First 30 days', payload.plan.roadmap.first30Days);
    this.drawRoadmapPhase(ctx, 'Days 31 to 60', payload.plan.roadmap.next60Days);
    this.drawRoadmapPhase(ctx, 'Days 61 to 90', payload.plan.roadmap.next90Days);
  }

  private drawOpportunities(ctx: PdfContext, opportunities: OpportunityItem[]): void {
    this.drawSectionTitle(ctx, 'Matched Opportunities');

    if (!opportunities.length) {
      this.drawBodyText(ctx, 'No opportunity matches were available for export in this run.');
      return;
    }

    for (const opportunity of opportunities) {
      this.ensureSpace(ctx, 24);
      this.drawListItemTitle(
        ctx,
        opportunity.title,
        [
          opportunity.type,
          opportunity.provider,
          [opportunity.mode, opportunity.location].filter(Boolean).join(' | '),
        ]
          .filter(Boolean)
          .join(' | '),
      );
      this.drawBodyText(ctx, this.buildOpportunityNote(opportunity), 8.7);
      this.drawLinksRow(ctx, [{ label: 'Open opportunity', url: opportunity.sourceUrl }]);
      this.drawDivider(ctx);
    }
  }

  private drawSectionTitle(ctx: PdfContext, title: string): void {
    this.ensureSpace(ctx, 16);
    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(14.5);
    ctx.doc.text(title, ctx.marginX, ctx.cursorY);
    ctx.doc.setDrawColor(...THEME.line);
    ctx.doc.setLineWidth(0.3);
    ctx.doc.line(ctx.marginX, ctx.cursorY + 3.5, ctx.pageWidth - ctx.marginX, ctx.cursorY + 3.5);
    ctx.cursorY += 10;
  }

  private drawBodyText(ctx: PdfContext, text: string, fontSize = 9.4): void {
    if (!text.trim()) {
      return;
    }

    ctx.doc.setTextColor(...THEME.muted);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(fontSize);
    const lines = ctx.doc.splitTextToSize(text.trim(), ctx.width);
    ctx.doc.text(lines, ctx.marginX, ctx.cursorY);
    ctx.cursorY += lines.length * (fontSize * 0.45) + 2.5;
  }

  private drawLabelAndParagraph(ctx: PdfContext, label: string, value: string): void {
    this.ensureSpace(ctx, 14);
    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.text(label, ctx.marginX, ctx.cursorY);
    ctx.cursorY += 4.5;
    this.drawBodyText(ctx, value, 9.1);
  }

  private drawKeyValueRows(
    ctx: PdfContext,
    rows: Array<{ label: string; value: string }>,
  ): void {
    for (const row of rows) {
      this.ensureSpace(ctx, 8);
      ctx.doc.setTextColor(...THEME.ink);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(8.7);
      ctx.doc.text(row.label, ctx.marginX, ctx.cursorY);

      ctx.doc.setTextColor(...THEME.muted);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(8.7);
      const lines = ctx.doc.splitTextToSize(row.value, ctx.width - 34);
      ctx.doc.text(lines, ctx.marginX + 34, ctx.cursorY);
      ctx.cursorY += Math.max(6, lines.length * 3.9 + 1);
    }

    ctx.cursorY += 2;
  }

  private drawListItemTitle(ctx: PdfContext, title: string, meta: string): void {
    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10.8);
    ctx.doc.text(title, ctx.marginX, ctx.cursorY);
    ctx.cursorY += 4.8;

    if (meta) {
      ctx.doc.setTextColor(...THEME.muted);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(8.4);
      const lines = ctx.doc.splitTextToSize(meta, ctx.width);
      ctx.doc.text(lines, ctx.marginX, ctx.cursorY);
      ctx.cursorY += lines.length * 3.8 + 1;
    }
  }

  private drawLinksRow(
    ctx: PdfContext,
    links: Array<{ label: string; url: string }>,
  ): void {
    const usableLinks = links.filter((item) => item.url.trim());
    if (!usableLinks.length) {
      return;
    }

    this.ensureSpace(ctx, 7);
    let x = ctx.marginX;
    for (const link of usableLinks) {
      ctx.doc.setTextColor(...THEME.accent);
      ctx.doc.setFont('helvetica', 'bold');
      ctx.doc.setFontSize(8.4);
      ctx.doc.textWithLink(link.label, x, ctx.cursorY, { url: link.url });
      x += ctx.doc.getTextWidth(link.label) + 14;
    }
    ctx.cursorY += 5.5;
  }

  private drawRoadmapPhase(ctx: PdfContext, label: string, items: string[]): void {
    this.ensureSpace(ctx, 16);
    ctx.doc.setTextColor(...THEME.ink);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9.1);
    ctx.doc.text(label, ctx.marginX, ctx.cursorY);
    ctx.cursorY += 4.5;

    for (const item of items.slice(0, 3)) {
      this.ensureSpace(ctx, 7);
      ctx.doc.setTextColor(...THEME.muted);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(8.8);
      ctx.doc.text('-', ctx.marginX, ctx.cursorY);
      const lines = ctx.doc.splitTextToSize(item, ctx.width - 5);
      ctx.doc.text(lines, ctx.marginX + 4, ctx.cursorY);
      ctx.cursorY += lines.length * 4 + 1;
    }

    ctx.cursorY += 1.5;
  }

  private drawDivider(ctx: PdfContext): void {
    ctx.doc.setDrawColor(...THEME.line);
    ctx.doc.setLineWidth(0.22);
    ctx.doc.line(ctx.marginX, ctx.cursorY, ctx.pageWidth - ctx.marginX, ctx.cursorY);
    ctx.cursorY += 5.5;
  }

  private drawInlineLabel(doc: jsPDF, x: number, y: number, text: string): void {
    const width = doc.getTextWidth(text) + 10;
    doc.setFillColor(...THEME.accentSoft);
    doc.roundedRect(x, y - 4.6, width, 7.4, 3.7, 3.7, 'F');
    doc.setTextColor(...THEME.accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(text, x + 5, y);
  }

  private ensureSpace(ctx: PdfContext, heightNeeded: number): void {
    if (ctx.cursorY + heightNeeded <= ctx.pageHeight - ctx.bottomY) {
      return;
    }

    ctx.doc.addPage();
    this.drawPageBackground(ctx);
    ctx.cursorY = ctx.topY;

    ctx.doc.setDrawColor(...THEME.line);
    ctx.doc.setLineWidth(0.28);
    ctx.doc.line(ctx.marginX, ctx.cursorY + 3, ctx.pageWidth - ctx.marginX, ctx.cursorY + 3);

    ctx.doc.setTextColor(...THEME.muted);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.text('Career Guidance Report', ctx.marginX, ctx.cursorY);
    ctx.doc.text(ctx.dateLabel, ctx.pageWidth - ctx.marginX, ctx.cursorY, {
      align: 'right',
    });

    ctx.cursorY += 12;
  }

  private async loadPdfLogoAsset(): Promise<PdfLogoAsset | null> {
    if (!this.logoAssetPromise) {
      this.logoAssetPromise = this.renderSvgLogoAsset();
    }

    return this.logoAssetPromise;
  }

  private async renderSvgLogoAsset(): Promise<PdfLogoAsset | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }

    try {
      const svgMarkup = this.getPdfLogoSvgMarkup();
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        const image = await this.loadImage(blobUrl);
        const scale = 4;
        const canvas = document.createElement('canvas');
        canvas.width = 340 * scale;
        canvas.height = 90 * scale;

        const context = canvas.getContext('2d');
        if (!context) {
          return null;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return {
          dataUrl: canvas.toDataURL('image/png'),
          width: 340,
          height: 90,
        };
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      return null;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load logo image'));
      image.src = src;
    });
  }

  private getPdfLogoSvgMarkup(): string {
    return `
<svg width="340" height="90" viewBox="0 0 340 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Afaq logo">
  <defs>
    <linearGradient id="afaq-pdf-figure-gradient" x1="33%" y1="14%" x2="68%" y2="100%">
      <stop offset="0%" stop-color="#C8C5F0" />
      <stop offset="100%" stop-color="#8880D8" />
    </linearGradient>
  </defs>
  <g transform="translate(4 5)">
    <path d="M8 64 C 19 51, 26 47, 33 49 S 48 58, 56 49 S 68 29, 77 23" fill="none" stroke="#534AB7" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 6"/>
    <g transform="translate(8 64)">
      <circle r="7" fill="#ffffff" stroke="#EF9F27" stroke-width="2" />
      <circle r="2.4" fill="#EF9F27" />
    </g>
    <g transform="translate(34 50)">
      <circle r="5" fill="#ffffff" stroke="#534AB7" stroke-width="2" />
      <circle r="1.8" fill="#534AB7" />
    </g>
    <g transform="translate(56 47)">
      <circle r="5" fill="#ffffff" stroke="#534AB7" stroke-width="2" />
      <circle r="1.8" fill="#534AB7" />
    </g>
    <ellipse cx="45" cy="61.8" rx="8.5" ry="2.8" fill="#534AB7" opacity="0.12" />
    <path d="M48 40 C 54 36, 63 31, 71 26" fill="none" stroke="#7F77DD" stroke-width="1" stroke-dasharray="3 4" stroke-linecap="round" opacity="0.48" />
    <g transform="translate(37 41)">
      <circle cx="8" cy="4.8" r="4.8" fill="url(#afaq-pdf-figure-gradient)" />
      <rect x="4.2" y="10" width="9" height="14" rx="4.4" fill="url(#afaq-pdf-figure-gradient)" />
      <path d="M5.4 13.5 C 2.8 15.4, 1.8 18.1, 1.2 21.5" fill="none" stroke="#AFA9EC" stroke-width="2" stroke-linecap="round" />
      <path d="M12.3 14 C 16.8 13.5, 20 11.4, 23.6 8.4" fill="none" stroke="#AFA9EC" stroke-width="2" stroke-linecap="round" />
      <path d="M6.6 23.8 C 5.6 27.8, 4.6 30.2, 1.8 33.2" fill="none" stroke="#8880D8" stroke-width="2.2" stroke-linecap="round" />
      <path d="M10.8 23.8 C 11.6 27.6, 13.3 29.6, 16.2 31.8" fill="none" stroke="#8880D8" stroke-width="2.2" stroke-linecap="round" />
    </g>
    <g transform="translate(77 23)">
      <circle r="10.5" fill="none" stroke="#1D9E75" stroke-width="2" stroke-dasharray="3 4" />
      <path d="M-4.6 -4.6 L4.6 4.6 M4.6 -4.6 L-4.6 4.6" fill="none" stroke="#1D9E75" stroke-width="2.2" stroke-linecap="round" />
    </g>
  </g>
  <g transform="translate(106 0)">
    <text x="0" y="44" fill="#534AB7" font-family="Inter, system-ui, sans-serif" font-size="46" font-weight="900" letter-spacing="-1.5">Afaq</text>
    <text x="0" y="66" fill="#B4B2A9" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700" letter-spacing="3.5">AI CAREER GUIDANCE</text>
  </g>
</svg>`.trim();
  }

  private drawFallbackLogo(doc: jsPDF, x: number, y: number): void {
    doc.setDrawColor(...THEME.accent);
    doc.setLineWidth(0.55);
    doc.setLineDashPattern([1.1, 1.3], 0);
    doc.lines(
      [
        [4, -4],
        [4, 2],
        [5, -2],
        [5, -5],
        [4, -1],
      ],
      x,
      y + 4.5,
      [1, 1],
      'S',
      false,
    );
    doc.setLineDashPattern([], 0);

    doc.setFillColor(239, 159, 39);
    doc.circle(x, y + 8, 1.1, 'F');
    doc.setFillColor(...THEME.accent);
    doc.circle(x + 8, y + 4.5, 0.8, 'F');
    doc.setFillColor(29, 158, 117);
    doc.circle(x + 15.2, y + 1.4, 0.85, 'F');

    doc.setTextColor(...THEME.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('Afaq.', x + 20, y + 5.5);

    doc.setTextColor(...THEME.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.text('AI CAREER GUIDANCE', x + 20, y + 10.5);
  }

  private drawFooters(doc: jsPDF): void {
    const totalPages = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...THEME.line);
      doc.setLineWidth(0.22);
      doc.line(18, pageHeight - 11.5, pageWidth - 18, pageHeight - 11.5);

      doc.setTextColor(...THEME.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.text('Prepared by Afaq for the ENSET Challenge final demo.', 18, pageHeight - 6.4);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - 18, pageHeight - 6.4, {
        align: 'right',
      });
    }
  }

  private buildProfileSnapshotText(payload: ResultReportExportPayload): string {
    const strengths = this.takeList(payload.analyzedProfile.strengths, 2);
    const interests = this.takeList(payload.analyzedProfile.interests, 2);
    const signals = [...strengths, ...interests].slice(0, 3);

    return this.cleanSentence(
      `The profile suggests a ${payload.profileTitle.toLowerCase()} mindset with strong signals in ${this.joinNaturalList(
        signals,
        'problem solving and curiosity',
      )}. ${payload.diagnosis?.summary || 'A practical exploration strategy is recommended.'}`,
    );
  }

  private buildCareerFitText(payload: ResultReportExportPayload): string {
    const strengths = this.takeList(payload.analyzedProfile.strengths, 2);
    const reasons = this.takeList(payload.selectedChoice.reasons, 2).map((reason) =>
      this.cleanSentence(reason),
    );
    const parts = [
      `This path fits the current profile well, especially around ${this.joinNaturalList(
        strengths,
        'practical learning and clear motivation',
      )}.`,
      ...reasons,
    ];

    return this.cleanSentence(parts.join(' '));
  }

  private buildProgramNote(option: StudyOption): string {
    const reason = this.cleanSentence(option.whyRelevant || '');
    if (reason) {
      return reason;
    }

    const degree = option.degreeLevel ? `${option.degreeLevel.toLowerCase()} track` : 'program';
    return `A relevant ${degree} with a clear link to the selected direction.`;
  }

  private buildOpportunityNote(opportunity: OpportunityItem): string {
    const cleaned = this.cleanSentence(opportunity.whyRelevant || '');
    if (cleaned && !/^relevant because/i.test(cleaned)) {
      return cleaned;
    }

    const skills = this.takeList(opportunity.skills, 2).map((item) => item.toLowerCase());
    const type = opportunity.type.toLowerCase();

    if (type.includes('intern')) {
      return skills.length
        ? `Good entry point for internship-oriented exploration while strengthening ${this.joinNaturalList(skills)}.`
        : 'A useful early step for gaining real-world exposure in this direction.';
    }

    if (type.includes('hack') || type.includes('challenge') || type.includes('competition')) {
      return skills.length
        ? `Strong early exposure to collaborative building, with room to sharpen ${this.joinNaturalList(skills)}.`
        : 'A strong way to build proof of work, delivery rhythm, and visibility.';
    }

    if (type.includes('project') || type.includes('bootcamp')) {
      return skills.length
        ? `Useful for building portfolio evidence and practicing ${this.joinNaturalList(skills)}.`
        : 'A practical option for building portfolio evidence and consistent execution.';
    }

    return cleaned || 'A credible next step for gaining practical exposure in the selected path.';
  }

  private describeAcademicContext(payload: ResultReportExportPayload): string {
    const level = payload.analyzedProfile.academicLevel.replace(/_/g, ' ');
    return `${this.toTitleCase(level)} | ${payload.skillLevelLabel}`;
  }

  private cleanSentence(text: string): string {
    return String(text || '')
      .replace(/^relevant because\s*/i, '')
      .replace(/^this path fits because\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
      .replace(/^[a-z]/, (char) => char.toUpperCase())
      .replace(/([^.!?])$/, '$1.');
  }

  private takeList(values: string[] | undefined, count: number): string[] {
    return Array.isArray(values)
      ? values.map((value) => value.trim()).filter(Boolean).slice(0, count)
      : [];
  }

  private joinNaturalList(values: string[], fallback = 'relevant skills'): string {
    const clean = values.map((value) => this.toTitleCase(value)).filter(Boolean);
    if (!clean.length) return fallback;
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')}, and ${clean.at(-1)}`;
  }

  private toTitleCase(value: string): string {
    return String(value || '')
      .split(/[\s-]+/g)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
}
