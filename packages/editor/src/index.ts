// @commonpub/editor — TipTap block editor extensions + serialization

// Block type system
export type { BlockTuple, TypedBlockTuple, BlockDefinition } from './blocks/types.js';
export {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
  galleryContentSchema,
  videoContentSchema,
  embedContentSchema,
  markdownContentSchema,
  dividerContentSchema,
  partsListContentSchema,
  buildStepContentSchema,
  toolListContentSchema,
  downloadsContentSchema,
  quizContentSchema,
  interactiveSliderContentSchema,
  checkpointContentSchema,
  mathNotationContentSchema,
} from './blocks/schemas.js';
export type {
  TextContent,
  HeadingContent,
  CodeContent,
  ImageContent,
  QuoteContent,
  CalloutContent,
  GalleryContent,
  VideoContent,
  EmbedContent,
  MarkdownContent,
  DividerContent,
  PartsListContent,
  BuildStepContent,
  ToolListContent,
  DownloadsContent,
  QuizContent,
  InteractiveSliderContent,
  CheckpointContent,
  MathNotationContent,
} from './blocks/schemas.js';
export {
  registerBlock,
  lookupBlock,
  listBlocks,
  validateBlock,
  clearRegistry,
  registerCoreBlocks,
} from './blocks/registry.js';

// Serialization
export {
  blockTuplesToDoc,
  docToBlockTuples,
  validateBlockTuples,
  buildEditorSchema,
} from './serialization.js';

// TipTap extensions
export { CommonPubText } from './extensions/text.js';
export { CommonPubHeading } from './extensions/heading.js';
export { CommonPubCodeBlock } from './extensions/code.js';
export { CommonPubImage } from './extensions/image.js';
export { CommonPubQuote } from './extensions/quote.js';
export { CommonPubCallout } from './extensions/callout.js';
export { CommonPubGallery } from './extensions/gallery.js';
export { CommonPubVideo } from './extensions/video.js';
export { CommonPubEmbed } from './extensions/embed.js';
export { CommonPubMarkdown } from './extensions/markdown.js';
export { CommonPubPartsList } from './extensions/partsList.js';
export { CommonPubBuildStep } from './extensions/buildStep.js';
export { CommonPubToolList } from './extensions/toolList.js';
export { CommonPubDownloads } from './extensions/downloads.js';
export { CommonPubQuiz } from './extensions/quiz.js';
export { CommonPubInteractiveSlider } from './extensions/interactiveSlider.js';
export { CommonPubCheckpoint } from './extensions/checkpoint.js';
export { CommonPubMathNotation } from './extensions/mathNotation.js';

// Editor factory
export { createCommonPubEditor } from './editorKit.js';
export type { CreateCommonPubEditorOptions } from './editorKit.js';
