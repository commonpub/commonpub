// Types
export type {
  ExplainerSectionType,
  ExplainerDifficulty,
  VisualConfig,
  SliderControl,
  ToggleControl,
  SelectControl,
  InteractiveControl,
  QuizOption,
  QuizQuestion,
  ExplainerSectionBase,
  TextSection,
  InteractiveSection,
  QuizSection,
  CheckpointSection,
  ExplainerSection,
  ExplainerMeta,
  SectionDefinition,
  SectionProgress,
  ExplainerProgressState,
  TocItem,
  ExportOptions,
  AnswerResult,
  QuizResult,
  // Document Format
  ExplainerThemePreset,
  ExplainerThemeTokens,
  ExplainerThemeRef,
  ModuleConfig,
  SectionAside,
  ExplainerDocSection,
  ExplainerHero,
  ExplainerConclusion,
  ExplainerDocument,
} from './types.js';

// Type guard + helpers
export { isExplainerDocument, resolveThemePreset, resolveThemeOverrides, createEmptyDocument } from './types.js';

// Schemas
export {
  textSectionSchema,
  interactiveSectionSchema,
  quizSectionSchema,
  checkpointSectionSchema,
  explainerSectionSchema,
  explainerSectionsSchema,
  explainerMetaSchema,
  // Document schemas
  explainerThemePresetSchema,
  explainerThemeTokensSchema,
  explainerThemeRefSchema,
  moduleConfigSchema,
  sectionAsideSchema,
  explainerDocSectionSchema,
  explainerHeroSchema,
  explainerConclusionSchema,
  explainerDocumentSchema,
} from './schemas.js';

// Section registry
export {
  registerSectionType,
  lookupSectionType,
  listSectionTypes,
  validateSection,
  clearRegistry,
  registerCoreSectionTypes,
} from './sections/registry.js';

// Quiz engine
export {
  checkAnswer,
  scoreQuiz,
  isQuizPassed,
  validateQuizAnswers,
  shuffleOptions,
} from './quiz/engine.js';

// Progress tracker
export {
  createProgressState,
  markSectionCompleted,
  canAccessSection,
  getCompletionPercentage,
  getNextIncompleteSection,
  isExplainerComplete,
} from './progress/tracker.js';

// TOC generator
export { generateToc } from './render/tocGenerator.js';

// Section renderer
export {
  renderBlockTuples,
  renderQuizHtml,
  renderControlsHtml,
  renderCheckpointHtml,
  renderSection,
} from './render/sectionRenderer.js';

// Section derivation
export {
  deriveSections,
  computeSectionRanges,
} from './sections/derive.js';
export type { DerivedSection, SectionRange } from './sections/derive.js';

// HTML exporter
export { generateExplainerHtml } from './export/htmlExporter.js';
