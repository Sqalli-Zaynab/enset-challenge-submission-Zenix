import {
  CareerChoice,
  CareerRecommendations,
  Diagnosis,
  NormalizedProfile,
} from '../profile-flow.types';

export type RadarAxisLabel = 'Logic' | 'Build' | 'People' | 'Impact' | 'Creative';

export interface RadarAxis {
  label: RadarAxisLabel;
  lineX: number;
  lineY: number;
  labelX: number;
  labelY: number;
}

export interface ToneConfig {
  iconClass: string;
  badgeClass: string;
  accent: [number, number, number];
  surface: [number, number, number];
  text: [number, number, number];
}

export interface SkillBuildMetric {
  label: string;
  progress: number;
}

export interface StrengthMetric {
  label: string;
  progress: number;
}

export const RADAR_AXIS_LABELS: RadarAxisLabel[] = [
  'Logic',
  'Build',
  'People',
  'Impact',
  'Creative',
];

export const RADAR_LEVELS = [0.28, 0.52, 0.76, 1];

export const PROFILE_TITLE_BY_CAREER: Record<string, string> = {
  'software-engineering': 'The Logical Builder',
  'web-development': 'The Web Craftsperson',
  'data-and-ai': 'The Insight Architect',
  cybersecurity: 'The Digital Guardian',
  'ui-ux-design': 'The Empathetic Designer',
  'product-management': 'The Product Strategist',
  'business-analysis': 'The Business Interpreter',
  'project-management': 'The Delivery Organizer',
  'digital-marketing': 'The Audience Builder',
  'graphic-design': 'The Visual Communicator',
  'content-creation-media': 'The Story Builder',
  'teaching-edtech': 'The Learning Guide',
  'hr-talent-development': 'The People Developer',
  'industrial-engineering': 'The Process Optimizer',
  'embedded-systems-electronics': 'The Hardware Systems Builder',
  'entrepreneurship-startup-operations': 'The Venture Operator',
};

export const RADAR_SCORES_BY_CAREER: Record<string, number[]> = {
  'software-engineering': [0.88, 0.84, 0.58, 0.74, 0.62],
  'web-development': [0.72, 0.86, 0.62, 0.68, 0.78],
  'data-and-ai': [0.94, 0.72, 0.5, 0.76, 0.46],
  cybersecurity: [0.91, 0.7, 0.44, 0.72, 0.48],
  'ui-ux-design': [0.56, 0.68, 0.82, 0.7, 0.92],
  'product-management': [0.7, 0.8, 0.9, 0.82, 0.66],
  'business-analysis': [0.86, 0.62, 0.78, 0.72, 0.48],
  'project-management': [0.68, 0.78, 0.9, 0.76, 0.48],
  'digital-marketing': [0.5, 0.68, 0.88, 0.68, 0.84],
  'graphic-design': [0.46, 0.7, 0.7, 0.62, 0.94],
  'content-creation-media': [0.48, 0.66, 0.88, 0.72, 0.9],
  'teaching-edtech': [0.58, 0.62, 0.94, 0.9, 0.68],
  'hr-talent-development': [0.56, 0.58, 0.94, 0.82, 0.52],
  'industrial-engineering': [0.86, 0.84, 0.62, 0.74, 0.42],
  'embedded-systems-electronics': [0.86, 0.9, 0.48, 0.7, 0.5],
  'entrepreneurship-startup-operations': [0.7, 0.82, 0.88, 0.82, 0.72],
};

export const EMPTY_RADAR_SCORES = [0.62, 0.62, 0.62, 0.62, 0.62];

export const CARD_TONES_BY_LABEL: Record<CareerChoice['label'], ToneConfig> = {
  best_fit: {
    iconClass: 'recommendation-card__icon--purple',
    badgeClass: 'recommendation-card__badge--purple',
    accent: [69, 58, 166],
    surface: [236, 233, 255],
    text: [69, 58, 166],
  },
  alternative: {
    iconClass: 'recommendation-card__icon--green',
    badgeClass: 'recommendation-card__badge--green',
    accent: [31, 161, 118],
    surface: [223, 243, 236],
    text: [14, 100, 80],
  },
  safe_option: {
    iconClass: 'recommendation-card__icon--sand',
    badgeClass: 'recommendation-card__badge--sand',
    accent: [239, 159, 39],
    surface: [249, 237, 214],
    text: [135, 83, 31],
  },
};

const CAREER_SKILLS_BY_ID: Record<string, SkillBuildMetric[]> = {
  'software-engineering': [
    { label: 'JavaScript / TypeScript', progress: 0.9 },
    { label: 'React / Angular', progress: 0.82 },
    { label: 'Node.js + APIs', progress: 0.76 },
    { label: 'Git & version control', progress: 0.68 },
    { label: 'Algorithms & DSA', progress: 0.58 },
    { label: 'System design basics', progress: 0.42 },
  ],
  'web-development': [
    { label: 'HTML / CSS / JavaScript', progress: 0.9 },
    { label: 'Responsive UI', progress: 0.82 },
    { label: 'Frontend framework', progress: 0.74 },
    { label: 'APIs & deployment', progress: 0.66 },
    { label: 'Accessibility basics', progress: 0.56 },
    { label: 'Portfolio polish', progress: 0.48 },
  ],
  'data-and-ai': [
    { label: 'Python + notebooks', progress: 0.9 },
    { label: 'SQL + data analysis', progress: 0.82 },
    { label: 'Statistics fundamentals', progress: 0.76 },
    { label: 'Data visualization', progress: 0.68 },
    { label: 'Machine learning basics', progress: 0.56 },
    { label: 'Prompting + AI workflows', progress: 0.44 },
  ],
  cybersecurity: [
    { label: 'Networking basics', progress: 0.88 },
    { label: 'Linux command line', progress: 0.78 },
    { label: 'Security fundamentals', progress: 0.74 },
    { label: 'Risk & threat modeling', progress: 0.64 },
    { label: 'Scripting for security', progress: 0.54 },
    { label: 'Cloud security basics', progress: 0.42 },
  ],
  'ui-ux-design': [
    { label: 'UX research', progress: 0.88 },
    { label: 'Wireframes & flows', progress: 0.8 },
    { label: 'UI systems', progress: 0.72 },
    { label: 'Prototyping', progress: 0.64 },
    { label: 'Accessibility', progress: 0.56 },
    { label: 'Design storytelling', progress: 0.44 },
  ],
  'product-management': [
    { label: 'Problem framing', progress: 0.88 },
    { label: 'Roadmapping', progress: 0.8 },
    { label: 'User research', progress: 0.74 },
    { label: 'Delivery alignment', progress: 0.68 },
    { label: 'Analytics & prioritization', progress: 0.58 },
    { label: 'Stakeholder communication', progress: 0.48 },
  ],
  'digital-marketing': [
    { label: 'Content strategy', progress: 0.88 },
    { label: 'Audience research', progress: 0.78 },
    { label: 'Campaign planning', progress: 0.72 },
    { label: 'Analytics & reporting', progress: 0.64 },
    { label: 'Social growth systems', progress: 0.56 },
    { label: 'Brand storytelling', progress: 0.48 },
  ],
  'business-analysis': [
    { label: 'Requirements discovery', progress: 0.88 },
    { label: 'Process mapping', progress: 0.8 },
    { label: 'Excel / dashboards', progress: 0.72 },
    { label: 'SQL basics', progress: 0.62 },
    { label: 'Stakeholder interviews', progress: 0.56 },
    { label: 'Business case writing', progress: 0.46 },
  ],
  'project-management': [
    { label: 'Planning & scope', progress: 0.88 },
    { label: 'Kanban / agile basics', progress: 0.78 },
    { label: 'Risk tracking', progress: 0.68 },
    { label: 'Team coordination', progress: 0.64 },
    { label: 'Progress reporting', progress: 0.56 },
    { label: 'Stakeholder updates', progress: 0.48 },
  ],
  'graphic-design': [
    { label: 'Typography', progress: 0.88 },
    { label: 'Layout & composition', progress: 0.82 },
    { label: 'Brand identity', progress: 0.74 },
    { label: 'Figma / Adobe basics', progress: 0.66 },
    { label: 'Design critique', progress: 0.56 },
    { label: 'Portfolio presentation', progress: 0.48 },
  ],
  'content-creation-media': [
    { label: 'Storytelling', progress: 0.88 },
    { label: 'Content planning', progress: 0.8 },
    { label: 'Script writing', progress: 0.72 },
    { label: 'Video/audio editing', progress: 0.64 },
    { label: 'Publishing rhythm', progress: 0.56 },
    { label: 'Audience analytics', progress: 0.46 },
  ],
  'teaching-edtech': [
    { label: 'Instructional design', progress: 0.88 },
    { label: 'Clear explanation', progress: 0.82 },
    { label: 'Learning content', progress: 0.72 },
    { label: 'Assessment basics', progress: 0.62 },
    { label: 'EdTech tools', progress: 0.56 },
    { label: 'Learner feedback', progress: 0.48 },
  ],
  'hr-talent-development': [
    { label: 'People communication', progress: 0.88 },
    { label: 'Training design', progress: 0.78 },
    { label: 'Interview guides', progress: 0.7 },
    { label: 'Feedback systems', progress: 0.62 },
    { label: 'HR basics', progress: 0.56 },
    { label: 'Facilitation', progress: 0.48 },
  ],
  'industrial-engineering': [
    { label: 'Process mapping', progress: 0.88 },
    { label: 'Lean basics', progress: 0.8 },
    { label: 'Quality control', progress: 0.7 },
    { label: 'Operations analytics', progress: 0.64 },
    { label: 'Supply chain basics', progress: 0.54 },
    { label: 'Improvement case study', progress: 0.46 },
  ],
  'embedded-systems-electronics': [
    { label: 'Circuit basics', progress: 0.88 },
    { label: 'Microcontrollers', progress: 0.78 },
    { label: 'C programming', progress: 0.7 },
    { label: 'Sensors & IoT', progress: 0.62 },
    { label: 'Hardware debugging', progress: 0.54 },
    { label: 'Project documentation', progress: 0.46 },
  ],
  'entrepreneurship-startup-operations': [
    { label: 'Customer discovery', progress: 0.88 },
    { label: 'MVP validation', progress: 0.8 },
    { label: 'Basic finance', progress: 0.68 },
    { label: 'Sales experiments', progress: 0.62 },
    { label: 'Operations setup', progress: 0.56 },
    { label: 'Pitch storytelling', progress: 0.48 },
  ],
};

export function polarPoint(
  angleDeg: number,
  radius: number,
): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: Number((Math.cos(angle) * radius).toFixed(2)),
    y: Number((Math.sin(angle) * radius).toFixed(2)),
  };
}

export function serializePolygon(values: number[], radius: number): string {
  return values
    .map((value, index) => {
      const angle = -90 + (360 / values.length) * index;
      const point = polarPoint(angle, radius * value);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

export function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getProfileTitle(careerId: string | null | undefined): string {
  if (!careerId) {
    return 'The Curious Builder';
  }

  return PROFILE_TITLE_BY_CAREER[careerId] ?? 'The Curious Builder';
}

export function buildTraitTags(
  profile: NormalizedProfile | null | undefined,
  summary: CareerRecommendations['profileSummary'] | null | undefined,
): string[] {
  if (!profile) {
    return [];
  }

  const values = [
    ...profile.strengths,
    ...(summary?.themes ?? []),
    ...profile.values,
  ];

  const unique = values.filter((item, index, array) => {
    const normalized = item.toLowerCase();
    return (
      array.findIndex(
        (candidate) => candidate.toLowerCase() === normalized,
      ) === index
    );
  });

  return unique.slice(0, 4).map((item) => toTitleCase(item));
}

export function getSkillLevelLabel(
  profile: Pick<NormalizedProfile, 'skillLevel'> | null | undefined,
): string {
  const level = profile?.skillLevel ?? 'intermediate';
  return toTitleCase(level);
}

export function getReadinessLabel(
  profile: Pick<NormalizedProfile, 'readiness'> | null | undefined,
): string {
  const readiness = profile?.readiness;

  if (typeof readiness !== 'number') {
    return 'Readiness building';
  }

  return `Readiness ${Math.round(readiness)}/100`;
}

export function getConfidenceLabel(
  score: number | null | undefined,
  readiness: number | null | undefined,
  diagnosis: Diagnosis | null | undefined,
): string {
  const normalizedScore = typeof score === 'number' ? score : 0;
  const readinessBoost =
    typeof readiness === 'number' && Number.isFinite(readiness)
      ? readiness
      : 0;

  if (normalizedScore >= 90 || readinessBoost >= 3) {
    return 'High';
  }

  if (normalizedScore >= 78 || diagnosis?.recommendationMode === 'compare') {
    return 'Medium';
  }

  return 'Emerging';
}

export function getFieldLabel(
  profile: Pick<NormalizedProfile, 'fieldOfStudy'> | null | undefined,
  fallbackCareerTitle?: string,
): string {
  if (profile?.fieldOfStudy.trim()) {
    return toTitleCase(profile.fieldOfStudy);
  }

  return fallbackCareerTitle ?? 'Career exploration';
}

export function getCareerSkills(choiceId: string | undefined): SkillBuildMetric[] {
  if (!choiceId) {
    return CAREER_SKILLS_BY_ID['software-engineering'];
  }

  return CAREER_SKILLS_BY_ID[choiceId] ?? CAREER_SKILLS_BY_ID['software-engineering'];
}

export function buildStrengthMetrics(
  profile: NormalizedProfile | null | undefined,
  summary: CareerRecommendations['profileSummary'] | null | undefined,
): StrengthMetric[] {
  if (!profile) {
    return [];
  }

  const labels = [
    ...profile.strengths,
    ...(summary?.themes ?? []),
    ...profile.values,
  ]
    .map((item) => toTitleCase(item))
    .filter(Boolean);

  const uniqueLabels = labels.filter(
    (item, index) =>
      labels.findIndex(
        (candidate) => candidate.toLowerCase() === item.toLowerCase(),
      ) === index,
  );

  const progressLevels = [0.91, 0.84, 0.76, 0.68, 0.6];

  return uniqueLabels.slice(0, progressLevels.length).map((label, index) => ({
    label,
    progress: progressLevels[index] ?? 0.52,
  }));
}

export function getCareerIconPath(choiceId: string): string {
  switch (choiceId) {
    case 'software-engineering':
    case 'web-development':
      return 'M5 7h14M8 11l-3 3 3 3M16 11l3 3-3 3M12 7l-2 12';
    case 'data-and-ai':
      return 'M7 18h10M8 15l2-3 3 2 4-6M7 7h.01M12 7h.01M17 7h.01';
    case 'product-management':
    case 'project-management':
    case 'entrepreneurship-startup-operations':
      return 'M12 5v14M5 12h14M8 8h8v8H8z';
    case 'ui-ux-design':
    case 'graphic-design':
      return 'M7 17l10-10M8 8h4v4H8zM12 12h4v4h-4z';
    case 'cybersecurity':
      return 'M12 4l6 3v4c0 4.5-2.6 7.7-6 9-3.4-1.3-6-4.5-6-9V7l6-3Z';
    case 'business-analysis':
      return 'M5 16h14M7 13l3-4 3 2 4-6M6 6h12';
    case 'content-creation-media':
      return 'M5 6h10l4 4v8H5zM8 10h7M8 14h5';
    case 'teaching-edtech':
      return 'M4 7l8-3 8 3-8 3-8-3ZM7 10v5c2 2 8 2 10 0v-5';
    case 'hr-talent-development':
      return 'M8 9a4 4 0 1 0 8 0M4 18c1.5-4 14.5-4 16 0';
    case 'industrial-engineering':
      return 'M5 17h14M7 17V9l5-3 5 3v8M9 13h6';
    case 'embedded-systems-electronics':
      return 'M7 7h10v10H7zM4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3';
    default:
      return 'M5 18h14M7 14V8h10v6M9.5 18v-4m5 4v-4';
  }
}
