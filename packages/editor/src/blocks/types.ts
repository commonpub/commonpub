import type { ZodType } from 'zod';
import type {
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
  SectionHeaderContent,
} from './schemas.js';

/** Discriminated union of all known block types */
export type TypedBlockTuple =
  | ['text', TextContent]
  | ['heading', HeadingContent]
  | ['code', CodeContent]
  | ['image', ImageContent]
  | ['quote', QuoteContent]
  | ['callout', CalloutContent]
  | ['gallery', GalleryContent]
  | ['video', VideoContent]
  | ['embed', EmbedContent]
  | ['markdown', MarkdownContent]
  | ['divider', DividerContent]
  | ['partsList', PartsListContent]
  | ['buildStep', BuildStepContent]
  | ['toolList', ToolListContent]
  | ['downloads', DownloadsContent]
  | ['quiz', QuizContent]
  | ['interactiveSlider', InteractiveSliderContent]
  | ['checkpoint', CheckpointContent]
  | ['mathNotation', MathNotationContent]
  | ['sectionHeader', SectionHeaderContent];

/** A block is a [type, content] tuple — accepts both typed and unknown block types for extensibility */
export type BlockTuple = TypedBlockTuple | [string, Record<string, unknown>];

/** Definition for a registered block type */
export interface BlockDefinition<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique block type identifier (e.g., 'text', 'heading', 'code') */
  type: string;
  /** Zod schema for validating block content */
  schema: ZodType<T>;
  /** Human-readable label for the block type */
  label: string;
}
