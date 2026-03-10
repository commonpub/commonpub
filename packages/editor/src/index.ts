// @snaplify/editor — TipTap block editor extensions + serialization

// Block type system
export type { BlockTuple, BlockDefinition } from './blocks/types';
export {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
} from './blocks/schemas';
export type {
  TextContent,
  HeadingContent,
  CodeContent,
  ImageContent,
  QuoteContent,
  CalloutContent,
} from './blocks/schemas';
export {
  registerBlock,
  lookupBlock,
  listBlocks,
  validateBlock,
  clearRegistry,
  registerCoreBlocks,
} from './blocks/registry';

// Serialization
export {
  blockTuplesToDoc,
  docToBlockTuples,
  validateBlockTuples,
  buildEditorSchema,
} from './serialization';

// TipTap extensions
export { SnaplifyText } from './extensions/text';
export { SnaplifyHeading } from './extensions/heading';
export { SnaplifyCodeBlock } from './extensions/code';
export { SnaplifyImage } from './extensions/image';
export { SnaplifyQuote } from './extensions/quote';
export { SnaplifyCallout } from './extensions/callout';

// Editor factory
export { createSnaplifyEditor } from './editorKit';
export type { CreateSnaplifyEditorOptions } from './editorKit';
