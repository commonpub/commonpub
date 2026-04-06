import type { BlockTuple } from '@commonpub/editor';
import type { ZodType } from 'zod';

/** Section types supported by the explainer system */
export type ExplainerSectionType = 'text' | 'interactive' | 'quiz' | 'checkpoint';

/** Difficulty levels for explainers */
export type ExplainerDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** Visual configuration for animated/interactive sections (Phase 5b) */
export interface VisualConfig {
  type: 'animation' | 'diagram' | 'code-demo';
  config: Record<string, unknown>;
}

/** Slider control for interactive sections */
export interface SliderControl {
  type: 'slider';
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

/** Toggle control for interactive sections */
export interface ToggleControl {
  type: 'toggle';
  id: string;
  label: string;
  defaultValue: boolean;
}

/** Select control for interactive sections */
export interface SelectControl {
  type: 'select';
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
}

/** Union of all interactive control types */
export type InteractiveControl = SliderControl | ToggleControl | SelectControl;

/** A quiz option (multiple choice) */
export interface QuizOption {
  id: string;
  text: string;
}

/** A quiz question with multiple-choice options */
export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
}

/** Base fields shared by all section types */
export interface ExplainerSectionBase {
  id: string;
  title: string;
  anchor: string;
}

/** Text section — rich text content with optional visual config */
export interface TextSection extends ExplainerSectionBase {
  type: 'text';
  content: BlockTuple[];
  visualConfig?: VisualConfig;
}

/** Interactive section — content + controls driving visualizations */
export interface InteractiveSection extends ExplainerSectionBase {
  type: 'interactive';
  content: BlockTuple[];
  controls: InteractiveControl[];
  visualConfig: VisualConfig;
}

/** Quiz section — questions with scoring and optional gate enforcement */
export interface QuizSection extends ExplainerSectionBase {
  type: 'quiz';
  content: BlockTuple[];
  questions: QuizQuestion[];
  passingScore: number;
  isGate: boolean;
}

/** Checkpoint section — progress gate */
export interface CheckpointSection extends ExplainerSectionBase {
  type: 'checkpoint';
  content: BlockTuple[];
  requiresPrevious: boolean;
}

/** Union of all explainer section types */
export type ExplainerSection = TextSection | InteractiveSection | QuizSection | CheckpointSection;

/** Metadata for an explainer */
export interface ExplainerMeta {
  estimatedMinutes: number;
  difficulty: ExplainerDifficulty;
  description?: string;
  tags?: string[];
  prerequisites?: string[];
  learningObjectives?: string[];
}

/** Section definition for the registry */
export interface SectionDefinition<T extends ExplainerSectionBase = ExplainerSectionBase> {
  type: ExplainerSectionType;
  schema: ZodType<T>;
  label: string;
}

/** Progress state for a single section */
export interface SectionProgress {
  completed: boolean;
  quizScore?: number;
  completedAt?: string;
}

/** Progress state for an entire explainer */
export interface ExplainerProgressState {
  sections: Record<string, SectionProgress>;
  startedAt: string;
  lastAccessedAt: string;
}

/** TOC item for rendering the table of contents */
export interface TocItem {
  id: string;
  title: string;
  anchor: string;
  completed: boolean;
  active: boolean;
  locked: boolean;
}

/** Options for HTML export */
export interface ExportOptions {
  includeAnimations: boolean;
  inlineImages: boolean;
  theme: 'base' | 'dark' | 'generics' | 'agora' | 'agora-dark';
  title: string;
  description?: string;
  author?: string;
}

/** Result of checking a quiz answer */
export interface AnswerResult {
  correct: boolean;
  explanation?: string;
}

/** Result of scoring a complete quiz */
export interface QuizResult {
  score: number;
  passed: boolean;
  total: number;
  correct: number;
}

// ═══════════════════════════════════════════════════════════════
// EXPLAINER DOCUMENT FORMAT — Scroll-Based Explainer
// ═══════════════════════════════════════════════════════════════

/** Theme preset identifiers (from the Explorable Explainer Bible) */
export type ExplainerThemePreset = 'dark-industrial' | 'punk-zine' | 'paper-teal' | 'clean-light';

/** All customizable theme tokens — maps to CSS custom properties */
export interface ExplainerThemeTokens {
  'bg-page': string;
  'bg-section': string;
  'bg-section-alt': string;
  'bg-dark': string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;
  'accent': string;
  'accent-hover': string;
  'accent-light': string;
  'accent-glow': string;
  'border': string;
  'border-dark': string;
  'border-width': string;
  'font-display': string;
  'font-body': string;
  'font-ui': string;
  'font-import': string;
  'radius': string;
}

/** Theme reference — a preset name, or a preset + custom overrides */
export type ExplainerThemeRef =
  | ExplainerThemePreset
  | { preset: ExplainerThemePreset; overrides: Partial<ExplainerThemeTokens> };

/** Resolve the base preset from a theme reference */
export function resolveThemePreset(theme: ExplainerThemeRef): ExplainerThemePreset {
  return typeof theme === 'string' ? theme : theme.preset;
}

/** Resolve custom overrides from a theme reference (empty object if pure preset) */
export function resolveThemeOverrides(theme: ExplainerThemeRef): Partial<ExplainerThemeTokens> {
  return typeof theme === 'string' ? {} : (theme.overrides ?? {});
}

/** Module configuration for an interactive element within a section */
export interface ModuleConfig {
  /** Module type identifier (e.g. 'slider', 'quiz', 'toggle', 'reveal-cards') */
  type: string;
  /** Module-specific configuration passed as props to the module viewer */
  props: Record<string, unknown>;
}

/** Aside/callout content within a section */
export interface SectionAside {
  icon: string;
  label: string;
  text: string;
}

/** A section in the ExplainerDocument format */
export interface ExplainerDocSection {
  /** Unique section identifier */
  id: string;
  /** URL-safe anchor for scroll targeting */
  anchor: string;
  /** Section heading (the QUESTION) */
  heading: string;
  /** Body text before the interactive — rich-text-lite HTML (bold, italic, links) */
  body: string;
  /** Interactive module config (the INTERACT) — omit for text-only sections */
  module?: ModuleConfig;
  /** Post-interaction insight text (the INSIGHT) — names the discovery */
  insight?: string;
  /** Transition text to next section (the BRIDGE) — maintains momentum */
  bridge?: string;
  /** Optional aside/callout with icon and label */
  aside?: SectionAside;
  /** Author-only notes, not rendered */
  notes?: string;
}

/** Hero section data for the explainer opening */
export interface ExplainerHero {
  /** Main title (short, evocative) */
  title: string;
  /** Hook subtitle (creates curiosity) */
  subtitle?: string;
  /** Highlighted phrase within subtitle (accent-underlined) */
  highlight?: string;
  /** Scroll hint text (default: "Scroll to begin") */
  scrollHint?: string;
  /** Cover image URL for background */
  coverImageUrl?: string;
}

/** Conclusion section data for the explainer closing */
export interface ExplainerConclusion {
  /** Conclusion heading */
  heading: string;
  /** Summary body text — rich-text-lite HTML */
  body: string;
  /** Optional call-to-action link */
  callToAction?: {
    label: string;
    url: string;
  };
}

/** Structured document format for scroll-based explainers */
export interface ExplainerDocument {
  /** Format version — always 2 for the scroll-based format */
  version: 2;
  /** Theme — a preset name, or preset + custom overrides */
  theme: ExplainerThemeRef;
  /** Hero section (the opening) */
  hero: ExplainerHero;
  /** Content sections (QUESTION > INTERACT > INSIGHT > BRIDGE each) */
  sections: ExplainerDocSection[];
  /** Optional conclusion section (the closing) */
  conclusion?: ExplainerConclusion;
  /** Explainer metadata */
  meta: ExplainerMeta;
  /** Viewer settings */
  settings?: {
    showProgressBar?: boolean;
    showNavDots?: boolean;
    showFooter?: boolean;
    footerText?: string;
  };
}

/** Type guard: checks if data is an ExplainerDocument */
export function isExplainerDocument(data: unknown): data is ExplainerDocument {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    (data as Record<string, unknown>).version === 2 &&
    'sections' in data &&
    Array.isArray((data as Record<string, unknown>).sections) &&
    'hero' in data
  );
}

/** Create a blank ExplainerDocument for new explainers */
export function createEmptyDocument(title?: string): ExplainerDocument {
  return {
    version: 2,
    theme: 'dark-industrial',
    hero: {
      title: title || '',
      subtitle: '',
      scrollHint: 'Scroll to begin',
    },
    sections: [
      {
        id: `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        anchor: 'introduction',
        heading: '',
        body: '',
      },
    ],
    meta: {
      estimatedMinutes: 5,
      difficulty: 'beginner',
    },
    settings: {
      showProgressBar: true,
      showNavDots: true,
      showFooter: true,
      footerText: 'An explorable explanation',
    },
  };
}
