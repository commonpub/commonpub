import { z } from 'zod';

export const textContentSchema = z.object({
  html: z.string(),
});
export type TextContent = z.infer<typeof textContentSchema>;

export const headingContentSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type HeadingContent = z.infer<typeof headingContentSchema>;

export const codeContentSchema = z.object({
  code: z.string(),
  language: z.string(),
  filename: z.string().optional(),
});
export type CodeContent = z.infer<typeof codeContentSchema>;

/**
 * `size` controls the rendered width of the image. The viewer applies it
 * via a CSS class (e.g. `.cpub-image-size-m`):
 *   - `s` = ~320px max (small inline figure)
 *   - `m` = ~540px max (reading-friendly default for new uploads)
 *   - `l` = ~760px max (matches the ProjectView prose-image cap)
 *   - `full` = no width cap (fills its container up to 100%)
 *
 * Optional + back-compat: BlockTuples authored before this field existed
 * parse fine and render at `l` per the viewer's fallback (matches the
 * pre-size-picker behavior from layer 0.21.18).
 */
export const imageContentSchema = z.object({
  src: z.string().url(),
  alt: z.string(),
  caption: z.string().optional(),
  size: z.enum(['s', 'm', 'l', 'full']).optional(),
});
export type ImageContent = z.infer<typeof imageContentSchema>;
export type ImageSize = NonNullable<ImageContent['size']>;

export const quoteContentSchema = z.object({
  html: z.string(),
  attribution: z.string().optional(),
});
export type QuoteContent = z.infer<typeof quoteContentSchema>;

export const calloutContentSchema = z.object({
  html: z.string(),
  variant: z.enum(['info', 'tip', 'warning', 'danger']),
});
export type CalloutContent = z.infer<typeof calloutContentSchema>;

// === New block types ===

export const galleryContentSchema = z.object({
  images: z.array(z.object({
    src: z.string().url(),
    alt: z.string(),
    caption: z.string().optional(),
  })),
});
export type GalleryContent = z.infer<typeof galleryContentSchema>;

export const videoContentSchema = z.object({
  url: z.string().url(),
  platform: z.string(),
  caption: z.string().optional(),
  // Rendered-width preset (mirrors images). Missing ⇒ the viewer's 'l' fallback,
  // so videos render at a reading width centered, not stretched full-bleed.
  size: z.enum(['s', 'm', 'l', 'full']).optional(),
});
export type VideoContent = z.infer<typeof videoContentSchema>;

export const embedContentSchema = z.object({
  url: z.string().url(),
  type: z.string(),
  html: z.string().optional(),
  size: z.enum(['s', 'm', 'l', 'full']).optional(),
});
export type EmbedContent = z.infer<typeof embedContentSchema>;

export const markdownContentSchema = z.object({
  source: z.string(),
});
export type MarkdownContent = z.infer<typeof markdownContentSchema>;

export const dividerContentSchema = z.object({});
export type DividerContent = z.infer<typeof dividerContentSchema>;

export const partsListContentSchema = z.object({
  parts: z.array(z.object({
    name: z.string(),
    qty: z.number(),
    price: z.number().optional(),
    url: z.string().optional(),
    category: z.string().optional(),
    required: z.boolean().optional(),
  })),
});
export type PartsListContent = z.infer<typeof partsListContentSchema>;

export const buildStepContentSchema = z.object({
  stepNumber: z.number(),
  image: z.string().optional(),
  instructions: z.string(),
  time: z.string().optional(),
  partsUsed: z.array(z.string()).optional(),
});
export type BuildStepContent = z.infer<typeof buildStepContentSchema>;

export const toolListContentSchema = z.object({
  tools: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    required: z.boolean().optional(),
  })),
});
export type ToolListContent = z.infer<typeof toolListContentSchema>;

export const downloadsContentSchema = z.object({
  files: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    size: z.string().optional(),
    type: z.string().optional(),
  })),
});
export type DownloadsContent = z.infer<typeof downloadsContentSchema>;

export const quizContentSchema = z.object({
  question: z.string(),
  options: z.array(z.object({
    text: z.string(),
    correct: z.boolean(),
  })),
  feedback: z.string().optional(),
});
export type QuizContent = z.infer<typeof quizContentSchema>;

export const interactiveSliderContentSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  defaultValue: z.number(),
  states: z.array(z.object({
    range: z.tuple([z.number(), z.number()]).refine(
      ([lo, hi]) => lo <= hi,
      { message: 'range[0] must be <= range[1]' },
    ),
    label: z.string(),
    color: z.string().optional(),
  })),
}).refine(
  (data) => data.min < data.max,
  { message: 'min must be less than max' },
).refine(
  (data) => data.defaultValue >= data.min && data.defaultValue <= data.max,
  { message: 'defaultValue must be within [min, max]' },
);
export type InteractiveSliderContent = z.infer<typeof interactiveSliderContentSchema>;

export const checkpointContentSchema = z.object({
  message: z.string(),
});
export type CheckpointContent = z.infer<typeof checkpointContentSchema>;

export const mathNotationContentSchema = z.object({
  expression: z.string(),
  display: z.boolean().optional(),
});
export type MathNotationContent = z.infer<typeof mathNotationContentSchema>;

export const sectionHeaderContentSchema = z.object({
  tag: z.string(),
  title: z.string(),
  body: z.string().optional(),
});
export type SectionHeaderContent = z.infer<typeof sectionHeaderContentSchema>;
