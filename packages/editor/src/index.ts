// @commonpub/editor — TipTap block editor extensions + serialization

// Block type system
export type { BlockTuple, BlockDefinition } from './blocks/types.js';
export {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
} from './blocks/schemas.js';
export type {
  TextContent,
  HeadingContent,
  CodeContent,
  ImageContent,
  QuoteContent,
  CalloutContent,
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

// Editor factory
export { createCommonPubEditor } from './editorKit.js';
export type { CreateCommonPubEditorOptions } from './editorKit.js';
