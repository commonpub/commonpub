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
