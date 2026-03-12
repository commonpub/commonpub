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
} from './types.js';

// Schemas
export {
  textSectionSchema,
  interactiveSectionSchema,
  quizSectionSchema,
  checkpointSectionSchema,
  explainerSectionSchema,
  explainerSectionsSchema,
  explainerMetaSchema,
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

// HTML exporter
export { generateExplainerHtml } from './export/htmlExporter.js';
